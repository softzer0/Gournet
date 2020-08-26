from pytz import timezone as pytz_timezone
from django.utils.timezone import activate as tz_activate
from django.utils.translation import activate as lang_activate
from django.conf import settings
from django.http import JsonResponse
from stronghold.middleware import LoginRequiredMiddleware as StrongholdLoginRequiredMiddleware
from main.models import Business, Card
from pyotp import HOTP
from django.utils.timezone import now as timezone_now
from datetime import timedelta
from binascii import unhexlify
from hashlib import pbkdf2_hmac
from os import urandom
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

class Resp(Exception):
    pass

class TimezoneLocaleMiddleware:
    def process_request(self, request):
        if request.user.is_authenticated:
            tzname = request.session.get('timezone')
            if tzname:
                tz_activate(pytz_timezone(tzname))
            else:
                tz_activate(request.user.tz)
            lang_activate(request.user.language)
            request.LANGUAGE_CODE = request.user.language
        else:
            lang = request.GET.get('lang')
            if not lang:
                lang = request.session.get('language')
                if not lang:
                    lang = settings.LANGUAGE_CODE
                    request.session['language'] = lang
            else:
                request.session['language'] = lang
            if 'table' in request.session:
                tzname = request.session.get('tz')
                if tzname:
                    tz_activate(pytz_timezone(tzname))
            lang_activate(lang)
            request.LANGUAGE_CODE = lang
            if 'currency' not in request.session:
                request.session['currency'] = settings.DEFAULT_CURRENCY

    def process_response(self, request, response):
        if 'Content-Language' not in response:
            response['Content-Language'] = getattr(request, 'LANGUAGE_CODE', settings.LANGUAGE_CODE)
        return response

    def process_exception(self, request, exception):
        if isinstance(exception, Resp):
            return JsonResponse({'username': request.POST['username'], 'password': request.POST['password']})

def deriveKey(passphrase, salt=None):
    if salt is None:
        salt = urandom(8)
    return pbkdf2_hmac('sha256', passphrase.encode('utf8'), salt, 4096), salt

def decrypt(passphrase, ciphertext):
    try:
        salt, iv, ciphertext = map(unhexlify, ciphertext.split('-'))
        key, _ = deriveKey(passphrase, salt)
        aes = AESGCM(key)
        plaintext = aes.decrypt(iv, ciphertext, None)
        return plaintext.decode('utf8')
    except:
        return None

def gen_session(request, card, business):
    request.session['table'] = {'id': card.table.pk, 'shortname': business.shortname,
                                'time': (timezone_now() + timedelta(minutes=10)).timestamp()}

class LoginRequiredMiddleware(StrongholdLoginRequiredMiddleware):
    def process_view(self, request, view_func, view_args, view_kwargs):
        b = (request.GET.get('t', '').isnumeric() and request.GET.get('c', '').isnumeric() and request.GET.get('p', '').isnumeric(), request.GET.get('q'))
        if hasattr(view_func, 'TABLE_SESSION_CHECK') and ('shortname' in view_kwargs and (b[0] or b[1]) or 'table' in request.session):
            if 'table' not in request.session or b[0] or b[1]:
                business = Business.objects.filter_by_natural_key(view_kwargs['shortname']).filter(is_published=True).first()
                if business:
                    if b[0]:
                        card = Card.objects.filter(table__business=business, table__number=request.GET['t'], number=request.GET['c']).first()
                        if card:
                            hotp, i = HOTP(business.table_secret), 1
                            while i < 301 and request.GET['p'] != hotp.at(card.counter+i):
                                i += 1
                            if i < 301:
                                card.counter += i
                                card.save()
                                if card.table.get_current_waiter(True):
                                    return gen_session(request, card, business)
                            elif 'table' in request.session and card.table.get_current_waiter(True):
                                return
                    else:
                        try:
                            b = decrypt(business.table_qr_secret, b[1]).split(',')
                            card = Card.objects.get(pk=b[0])
                            if int(b[1]) > card.qr_counter:
                                card.qr_counter = int(b[1])
                                card.save()
                                return gen_session(request, card, business)
                        except:
                            pass
            else:
                return
        return super().process_view(request, view_func, view_args, view_kwargs)