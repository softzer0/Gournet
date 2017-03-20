from .models import User, Business, Recent, get_has_stars, CONTENT_TYPES, REVIEW_STATUS

REVIEW_STATUS_E = (
    (REVIEW_STATUS[0][1], 'label-primary'), #Started
    (REVIEW_STATUS[1][1], 'label-warning'), #Closed
    (REVIEW_STATUS[2][1], 'label-success'), #Completed
    (REVIEW_STATUS[3][1], 'label-danger'), #Declined
    (REVIEW_STATUS[4][1], 'label-info'), #Under review
    (REVIEW_STATUS[5][1], 'planned'), #Planned
    (REVIEW_STATUS[6][1], 'label-default'), #Archived
    (REVIEW_STATUS[7][1], 'feedback') #Need feedback
)

def base(request):
    if not request.user.is_authenticated():
        return {}

    recent_ord = ['-recent__' + _[1:] for _ in Recent._meta.ordering]
    def gen_qs(model):
        return model.objects.filter(recent__user=request.user).order_by(*recent_ord + model._meta.ordering)[:5]

    return {
        'content_types': CONTENT_TYPES,
        'review_status': REVIEW_STATUS_E,
        'has_stars': get_has_stars(),
        'favs': gen_qs(Business),
        'friends': gen_qs(User)
    }