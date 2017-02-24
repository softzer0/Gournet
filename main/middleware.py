from pytz import timezone as pytz_timezone
from django.utils.timezone import activate, deactivate
from django.utils.translation import activate as translation_activate, get_language
from django.middleware.locale import LocaleMiddleware

class TimezoneLocaleMiddleware(LocaleMiddleware):
    def process_request(self, request):
        if request.user.is_authenticated():
            tzname = request.session.get('timezone')
            if tzname:
                activate(pytz_timezone(tzname))
            else:
                activate(request.user.tz)
            translation_activate(request.user.language)
            request.LANGUAGE_CODE = get_language()
        else:
            super().process_request(request)
            deactivate()

    def process_response(self, request, response):
        if not hasattr(request, 'user') or not request.user.is_authenticated():
            return super().process_response(request, response)
        if 'Content-Language' not in response:
            response['Content-Language'] = get_language()
        return response