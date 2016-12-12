from main.models import User, Business, Recent, get_content_types, get_has_stars

def base(request):
    if not request.user.is_authenticated():
        return {}

    recent_ord = ['-recent__' + _[1:] for _ in Recent._meta.ordering]
    def gen_qs(model):
        return model.objects.filter(recent__user=request.user).order_by(*recent_ord + model._meta.ordering)[:5]

    return {
        'content_types': get_content_types(),
        'has_stars': get_has_stars(),
        'favs': gen_qs(Business),
        'friends': gen_qs(User)
    }