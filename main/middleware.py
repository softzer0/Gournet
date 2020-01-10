from pytz import timezone as pytz_timezone
from django.utils.timezone import activate as tz_activate
from django.utils.translation import activate as lang_activate
from django.conf import settings
from django.http import JsonResponse
from stronghold.middleware import LoginRequiredMiddleware as StrongholdLoginRequiredMiddleware
from main.models import Business, Table
from pyotp import HOTP
from django.utils.timezone import now as timezone_now
from datetime import timedelta

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


class LoginRequiredMiddleware(StrongholdLoginRequiredMiddleware):
    def process_view(self, request, view_func, view_args, view_kwargs):
        if hasattr(view_func, 'TABLE_SESSION_CHECK') and ('shortname' in view_kwargs and request.GET.get('t', '').isnumeric() and request.GET.get('p', '').isnumeric() or 'table' in request.session):
            if 'table' not in request.session or request.GET.get('t', '').isnumeric() and request.GET.get('p', '').isnumeric():
                business = Business.objects.filter_by_natural_key(view_kwargs['shortname']).first()
                if business:
                    table = Table.objects.filter(business=business, number=request.GET['t']).first()
                    if table:
                        hotp, i = HOTP(table.business.table_secret), 1
                        while i < 101 and request.GET['p'] != hotp.at(table.counter+i):
                            i += 1
                        if i < 101:
                            table.counter += i
                            table.save()
                            if table.get_current_waiter():
                                request.session['table'] = {'id': table.pk, 'shortname': business.shortname, 'time': (timezone_now()+timedelta(minutes=5)).timestamp()}
                                return None
                        elif 'table' in request.session:
                            return None
            else:
                return None
        return super().process_view(request, view_func, view_args, view_kwargs)