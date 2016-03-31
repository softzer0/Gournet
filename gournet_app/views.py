from django.views.generic import TemplateView
from stronghold.views import StrongholdPublicMixin


class IndexPageView(TemplateView):
    template_name = 'home.html'
