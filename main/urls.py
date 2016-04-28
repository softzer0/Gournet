from django.conf.urls import url #, include
# from django.views.generic.edit import CreateView
# from django.views.generic import TemplateView
from decorator_include import decorator_include
from . import views as main_views
from stronghold.decorators import public
from allauth.account import views
from .decorators import login_forbidden


urlpatterns = [
    # Custom

    url(r"^user/(?P<name>[\w.-]+)$", main_views.user, name="user_profile"),

    # Allauth related below

    url(r"^signup/$", public(views.signup), name="account_signup"),
    url(r"^$", main_views.home_index, name="account_login"),
    url(r"^logout/$", views.logout, name="account_logout"),

    url(r"^password/change/$", views.password_change,
        name="account_change_password"),
    url(r"^password/set/$", views.password_set, name="account_set_password"),

    url(r"^inactive/$", views.account_inactive, name="account_inactive"),

    # E-mail
    url(r"^email/$", views.email, name="account_email"),
    url(r"^confirm-email/$", public(views.email_verification_sent),
        name="account_email_verification_sent"),
    url(r"^confirm-email/(?P<key>[-:\w]+)/$", public(views.confirm_email),
        name="account_confirm_email"),

    # password reset
    url(r"^password/reset/$", public(views.password_reset),
        name="account_reset_password"),
    url(r"^password/reset/done/$", public(views.password_reset_done),
        name="account_reset_password_done"),
    url(r"^password/reset/key/(?P<uidb36>[0-9A-Za-z]+)-(?P<key>.+)/$",
        public(views.password_reset_from_key),
        name="account_reset_password_from_key"),
    url(r"^password/reset/key/done/$", public(views.password_reset_from_key_done),
        name="account_reset_password_from_key_done"),
]

urlpatterns += [url('^social/', decorator_include(login_forbidden, 'main.socialaccount_urls'))]

