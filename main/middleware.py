from pytz import timezone as pytz_timezone
from django.utils.timezone import activate as tz_activate
from django.utils.translation import activate as lang_activate
from django.conf import settings
from django.http import JsonResponse

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
            lang_activate(lang)

    def process_response(self, request, response):
        if 'Content-Language' not in response:
            response['Content-Language'] = getattr(request, 'LANGUAGE_CODE', settings.LANGUAGE_CODE)
        return response

    def process_exception(self, request, exception):
        if isinstance(exception, Resp):
            return JsonResponse({'username': request.POST['username'], 'password': request.POST['password']})