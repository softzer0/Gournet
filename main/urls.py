from django.conf.urls import url, include
# from django.views.generic.edit import CreateView
# from django.views.generic import TemplateView
from decorator_include import decorator_include
from . import views as main_views
from stronghold.decorators import public
from allauth.account import views
from .decorators import login_forbidden

urlpatterns = [
    # Custom

    url(r"^user/(?P<username>[\w.-]+)/$", main_views.show_profile, name="user_profile"),
    url(r"^images/(?P<username>[\w.-]+)/avatar/(?:(?P<size>(48|64))/)?$", main_views.return_avatar, name="avatar"),

    # API

    url(r'^api/notifications/(?:(?P<pk>\d+)/)?$', public(main_views.NotificationAPIView.as_view())),
    url(r'^api/notifications/read/(?P<page_number>(\d+|last))/$', main_views.notifs_set_all_read),
    url(r'^api/friends/(?:(?P<pk>\d+)/)?$', public(main_views.FriendsAPIView.as_view())),
    url(r'^api/email/$', public(main_views.EmailAPIView.as_view())),
#    url(r'^api-auth/', decorator_include(public, 'rest_framework.urls', namespace='rest_framework')),

    # Allauth related below

    url(r"^signup/$", public(views.signup), name="account_signup"),
    url(r"^$", main_views.home_index, name="account_login"),
    url(r"^logout/$", views.logout, name="account_logout"),

    url(r"^password/change/$", main_views.PasswordChangeView.as_view(), name="account_change_password"),
    url(r"^password/set/$", views.password_set, name="account_set_password"),

    #url(r"^inactive/$", views.account_inactive, name="account_inactive"),

    # E-mail
    url(r"^email/$", main_views.EmailView.as_view(), name="account_email"),
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


"""from django.conf import settings
if settings.DEBUG:
    from django.conf.urls.static import static
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)"""