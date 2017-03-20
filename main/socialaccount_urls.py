from importlib import import_module
from django.conf.urls import include, url
from allauth.socialaccount import providers
from allauth import app_settings


if app_settings.SOCIALACCOUNT_ENABLED:
    urlpatterns = [url('', include('allauth.socialaccount.urls'))]

    for provider in providers.registry.get_list():
        try:
            prov_mod = import_module(provider.get_package() + '.urls')
        except ImportError:
            continue
        prov_urlpatterns = getattr(prov_mod, 'urlpatterns', None)
        if prov_urlpatterns:
            urlpatterns += prov_urlpatterns
