from pytz import timezone as pytz_timezone
from django.utils.timezone import activate as tz_activate
from django.utils.translation import activate as lang_activate
from django.conf import settings
from django.http import JsonResponse
from django.db.models import F
from stronghold.middleware import LoginRequiredMiddleware as StrongholdLoginRequiredMiddleware
from main.models import Business, Card, Table
from pyotp import HOTP
from django.utils.timezone import now as timezone_now
from datetime import timedelta
from hashlib import pbkdf2_hmac
from os import urandom
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from io import BytesIO
from Crypto.Hash import CMAC
from Crypto.Cipher import AES
from struct import unpack
from binascii import unhexlify

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

class InvalidMessage(RuntimeError):
    pass

def calculate_sdmmac(sdm_file_read_key: bytes, picc_data: bytes):
    """
    Calculate SDMMAC for NTAG 424 DNA
    :param sdm_file_read_key: MAC calculation key (K_SDMFileReadKey)
    :param picc_data: PICCDataTag [ || UID ][ || SDMReadCtr ]]
    :return: calculated SDMMAC (8 bytes)
    """
    sv2stream = BytesIO()
    sv2stream.write(b'\x3C\xC3\x00\x01\x00\x80')
    sv2stream.write(picc_data)

    while sv2stream.getbuffer().nbytes % AES.block_size != 0:
        # zero padding till the end of the block
        sv2stream.write(b'\x00')

    c2 = CMAC.new(sdm_file_read_key, ciphermod=AES)
    c2.update(sv2stream.getvalue())
    sdmmac = CMAC.new(c2.digest(), ciphermod=AES).digest()

    return bytes(bytearray([sdmmac[i] for i in range(16) if i % 2 == 1]))

def decrypt_sun_message(sdm_meta_read_key: bytes,
                        sdm_file_read_key: bytes,
                        picc_enc_data: bytes,
                        sdmmac: bytes):
    """
    Decrypt SUN message for NTAG 424 DNA
    :param sdm_meta_read_key: SUN decryption key (K_SDMMetaReadKey)
    :param sdm_file_read_key: MAC calculation key (K_SDMFileReadKey)
    :param ciphertext: Encrypted SUN message
    :param mac: SDMMAC of the SUN message
    :return: Tuple: PICCDataTag (1 byte), Tag UID (bytes), Read counter (int)
    :raises:
        InvalidMessage: if SUN message is invalid
    """
    pstream = BytesIO(AES.new(sdm_meta_read_key, AES.MODE_CBC, IV=b'\x00' * 16).decrypt(picc_enc_data))
    datastream = BytesIO()

    picc_data_tag = pstream.read(1)
    uid_length = (picc_data_tag[0] & 0x0F)

    # uid = None
    read_ctr_num = None

    # so far this is the only length mentioned by datasheet
    # dont read the buffer any further if we don't recognize it
    if uid_length not in [0x07]:
        # fake SDMMAC calculation to avoid potential timing attacks
        calculate_sdmmac(sdm_file_read_key, b"\x00" * 10)
        raise InvalidMessage("Unsupported UID length")

    if (picc_data_tag[0] & 0x80) == 0x80:
        uid = pstream.read(uid_length)
        datastream.write(uid)

    if (picc_data_tag[0] & 0x40) == 0x40:
        read_ctr = pstream.read(3)
        datastream.write(read_ctr)
        read_ctr_num = unpack("<I", read_ctr + b"\x00")[0]

    if sdmmac != calculate_sdmmac(sdm_file_read_key, datastream.getvalue()):
        raise InvalidMessage("Message is not properly signed - invalid MAC")

    return read_ctr_num #picc_data_tag, uid,

def gen_session(request, card, business):
    request.session['table'] = {'id': card.table.pk, 'shortname': business.shortname,
                                'time': (timezone_now() + timedelta(minutes=10)).timestamp()}

class LoginRequiredMiddleware(StrongholdLoginRequiredMiddleware):
    def process_view(self, request, view_func, view_args, view_kwargs):
        b = [request.GET.get('t', '').isnumeric() and request.GET.get('c', '').isnumeric() or None, request.GET.get('q')]
        if b[0] and not b[1]:
            b[0] = False if request.GET.get('p', '').isnumeric() else True if len(request.GET.get('d', '')) == 32 and len(request.GET.get('m', '')) == 16 else None
        c = None
        if hasattr(view_func, 'TABLE_SESSION_CHECK') and ('shortname' in view_kwargs and (b[0] is not None or b[1]) or 'table' in request.session):
            if 'table' not in request.session or b[0] is not None or b[1]:
                business = Business.objects.filter_by_natural_key(view_kwargs['shortname']).filter(is_published=True).first()
                if business:
                    if b[0] is None:
                        try:
                            b = decrypt(business.table_qr_secret, b[1]).split(',')
                            c = Card.objects.get(pk=b[0])
                            if int(b[1]) > c.qr_counter:
                                c.qr_counter = int(b[1])
                                c.save()
                                if c.table.get_current_waiter(True):
                                    return gen_session(request, c, business)
                        except:
                            pass
                    else:
                        c = Card.objects.filter(table__business=business, table__number=request.GET['t'], number=request.GET['c']).first()
                        if c:
                            if b[0]:
                                try:
                                    key = business.table_new_secret.tobytes()
                                    read_ctr_num = decrypt_sun_message(sdm_meta_read_key=key,
                                                              sdm_file_read_key=key,
                                                              picc_enc_data=unhexlify(request.GET['d']),
                                                              sdmmac=unhexlify(request.GET['m']))
                                    if read_ctr_num > c.new_counter:
                                        c.new_counter = read_ctr_num
                                        c.save()
                                        if c.table.get_current_waiter(True):
                                            return gen_session(request, c, business)
                                except:
                                    pass
                            else:
                                hotp, i = HOTP(business.table_secret), 1
                                while i < 301 and request.GET['p'] != hotp.at(c.counter+i):
                                    i += 1
                                if i < 301:
                                    c.counter = F('counter') + i
                                    c.save()
                                    if c.table.get_current_waiter(True):
                                        return gen_session(request, c, business)
        if 'table' in request.session and (Table.objects.get(pk=request.session['table']['id']) if not c else c.table).get_current_waiter(True):
            return
        return super().process_view(request, view_func, view_args, view_kwargs)