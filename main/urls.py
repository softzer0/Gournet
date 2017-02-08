from django.conf.urls import url #, include
# from django.views.generic.edit import CreateView
# from django.views.generic import TemplateView
from decorator_include import decorator_include
from . import views as main_views
from stronghold.decorators import public
from allauth.account import views
from .decorators import login_forbidden

urlpatterns = [
    # Allauth related

    url(r"^signup/$", public(views.signup), name="account_signup"),
    url(r"^$", main_views.home_index, name="account_login"),
    url(r"^logout/$", views.logout, name="account_logout"),

    url(r"^password/$", main_views.PasswordChangeView.as_view(), name="account_change_password"),
    url(r"^password/set/$", views.password_set, name="account_set_password"),

    #url(r"^inactive/$", views.account_inactive, name="account_inactive"),

    # E-mail
    url(r"^email/$", main_views.EmailView.as_view(), name="account_email"),
    url(r"^email/confirm/$", views.email_verification_sent,
        name="account_email_verification_sent"),
    url(r"^email/confirm/(?P<key>[-:\w]+)/$", views.confirm_email,
        name="account_confirm_email"),

    # password reset
    url(r"^password/reset/$", views.password_reset,
        name="account_reset_password"),
    url(r"^password/reset/done/$", views.password_reset_done,
        name="account_reset_password_done"),
    url(r"^password/reset/key/(?P<uidb36>[0-9A-Za-z]+)-(?P<key>.+)/$",
        views.password_reset_from_key,
        name="account_reset_password_from_key"),
    url(r"^password/reset/key/done/$", views.password_reset_from_key_done,
        name="account_reset_password_from_key_done"),

    # API
    url(r'^api/feed/$', main_views.FeedAPIView.as_view()),
    url(r'^api/items/(?:(?P<pk>\d+)/)?$', main_views.ItemAPIView.as_view()),
    url(r'^api/comments/(?:(?P<pk>\d+)/)?$', main_views.CommentAPIView.as_view()),
    url(r'^api/reminders/(?:(?P<pk>\d+)/)?$', main_views.ReminderAPIView.as_view()),
    url(r'^api/likes/(?:(?P<pk>\d+)/)?$', main_views.LikeAPIView.as_view()),
    url(r'^api/events/(?:(?P<pk>\d+)/)?$', main_views.EventAPIView.as_view()),
    url(r'^api/events/(?P<pk>\d+)/notify/$', main_views.send_notifications),
    url(r'^api/notifications/(?:(?P<pk>\d+)/)?$', main_views.NotificationAPIView.as_view()),
    url(r'^api/notifications/read/$', main_views.notifs_set_all_read),
    url(r'^api/users/(?:(?P<pk>\d+)/)?$', main_views.UserAPIView.as_view()),
    url(r'^api/businesses/$', main_views.BusinessAPIView.as_view()),
    url(r'^api/home/$', main_views.HomeAPIView.as_view()),
    url(r'^api/emails/$', main_views.EmailAPIView.as_view()),
    url(r'^api/account/$', main_views.AccountAPIView.as_view()),
    url(r'^api/manager/$', main_views.ManagerAPIView.as_view()),
    #url(r'^api-auth/', decorator_include(public, 'rest_framework.urls', namespace='rest_framework')),

    # Other
    url(r"^edit\.html$", main_views.edit_view, name="edit"),
    url(r"^localization/$", main_views.localization_view, name="localization"),
    url(r"^upload/(?:(?P<pk_b>([\d]+|business))/)?$", main_views.upload_view, name="upload"),
    url(r'^my-business/$', main_views.create_business, name="create_business"),
    url(r"^images/(?P<pk>[\d]+)/avatar/(?:(?P<size>(32|48|64))/)?$", main_views.return_avatar, name="avatar"),
    url(r"^user/(?P<username>[\w.-]+)/$", main_views.show_profile, name="user_profile"),
    url(r"^(?P<shortname>[\w.-]+)/$", main_views.show_business, name="business_profile"),
]

urlpatterns += [url('^social/', decorator_include(login_forbidden, 'main.socialaccount_urls'))]


"""from django.conf import settings
from django.views.static import serve
if settings.DEBUG:
    urlpatterns += [url(r'^'+settings.MEDIA_URL[1:]+'(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT, 'show_indexes': True})]"""