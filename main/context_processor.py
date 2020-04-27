from django.db.models import F, Q, Count
from django.utils.timezone import now as timezone_now
from .models import User, Business, Recent, get_has_stars, REVIEW_STATUS

REVIEW_STATUS_E = ( #important
    (REVIEW_STATUS[0][1], 'label-primary'), #Started
    (REVIEW_STATUS[1][1], 'label-warning'), #Closed
    (REVIEW_STATUS[2][1], 'label-success'), #Completed
    (REVIEW_STATUS[3][1], 'label-danger'), #Declined
    (REVIEW_STATUS[4][1], 'label-info'), #Under review
    (REVIEW_STATUS[5][1], 'planned'), #Planned
    (REVIEW_STATUS[6][1], 'label-default'), #Archived
    (REVIEW_STATUS[7][1], 'feedback') #Need feedback
)

recent_ord = ['-recent__' + _[1:] for _ in Recent._meta.ordering]
def gen_qs(request, model):
    return model.objects.filter(recent__user=request.user).order_by(*recent_ord + model._meta.ordering)

def get_business_if_waiter(request, check_exist=False):
    if request.user.is_anonymous:
        return None
    now = timezone_now()
    day = '_sat' if now.weekday() == 5 else '_sun' if now.weekday() >= 5 else ''
    now = now.time()
    q = Q(**{'table__waiter__opened'+day+'__isnull': False}) & (Q(**{'table__waiter__closed'+day: F('table__waiter__opened'+day)}) | Q(**{'table__waiter__closed'+day+'__lt': F('table__waiter__opened'+day)}) & (Q(**{'table__waiter__opened'+day+'__lte': now}) | Q(**{'table__waiter__closed'+day+'__gt': now})) | Q(**{'table__waiter__closed'+day+'__gt': F('table__waiter__opened'+day)}) & (Q(**{'table__waiter__opened'+day+'__lte': now}) & Q(**{'table__waiter__closed'+day+'__gt': now})))
    qs = Business.objects.filter(Q(table__waiter__person=request.user) & q).annotate(Count('pk'))
    return qs.first() if not check_exist else qs.exists()

def recent(request):
    dic = {
        'review_status': REVIEW_STATUS_E,
        'has_stars': get_has_stars(),
        'show_orders': bool('table' in request.session or get_business_if_waiter(request, True)),
        'is_manager': Business.objects.filter(manager=request.user).exists() if request.user.is_authenticated else False
    }
    if request.user.is_authenticated:
        dic.update({
            'favs': gen_qs(request, Business)[:5],
            'friends': gen_qs(request, User)[:5]
        })
    return dic