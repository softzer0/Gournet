from pytz import timezone as pytz_timezone
from django.utils import timezone

class TimezoneMiddleware():
    def process_request(self, request):
        tzname = request.session.get('timezone')
        if tzname:
            timezone.activate(pytz_timezone(tzname))
        elif request.user.is_authenticated():
            timezone.activate(request.user.tz)
        else:
            timezone.deactivate()