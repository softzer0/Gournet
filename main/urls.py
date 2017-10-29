from django.conf.urls import url #, include
# from django.views.generic.edit import CreateView
# from django.views.generic import TemplateView
from decorator_include import decorator_include
from . import views
from stronghold.decorators import public
from allauth.account import views as allauth_views
from .decorators import login_forbidden
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    # Allauth related

    url(r"^signup/$", views.signup, name="account_signup"),
    url(r"^$", views.home_index, name="account_login"),
    url(r"^logout/$", allauth_views.logout, name="account_logout"),

    url(r"^password/$", views.PasswordChangeView.as_view(), name="account_change_password"),
    url(r"^password/set/$", allauth_views.password_set, name="account_set_password"),

    #url(r"^inactive/$", allauth_views.account_inactive, name="account_inactive"),

    # E-mail
    #url(r"^email/$", views.EmailView.as_view(), name="account_email"),
    url(r"^email/confirm/$", allauth_views.email_verification_sent,
        name="account_email_verification_sent"),
    url(r"^email/confirm/(?P<key>[-:\w]+)/$", allauth_views.confirm_email,
        name="account_confirm_email"),

    # password reset
    url(r"^password/reset/$", allauth_views.password_reset,
        name="account_reset_password"),
    url(r"^password/reset/done/$", allauth_views.password_reset_done,
        name="account_reset_password_done"),
    url(r"^password/reset/key/(?P<uidb36>[0-9A-Za-z]+)-(?P<key>.+)/$",
        allauth_views.password_reset_from_key,
        name="account_reset_password_from_key"),
    url(r"^password/reset/key/done/$", allauth_views.password_reset_from_key_done,
        name="account_reset_password_from_key_done"),

    # API
    url(r'^api/feed/$', views.FeedAPIView.as_view()),
    url(r'^api/items/(?:(?P<pk>\d+)/)?$', views.ItemAPIView.as_view()),
    url(r'^api/comments/(?:(?P<pk>\d+)/)?$', views.CommentAPIView.as_view()),
    url(r'^api/reminders/(?:(?P<pk>\d+)/)?$', views.ReminderAPIView.as_view()),
    url(r'^api/likes/(?:(?P<pk>\d+)/)?$', views.like_switch_view),
    url(r'^api/events/(?:(?P<pk>\d+)/)?$', views.EventAPIView.as_view()),
    url(r'^api/events/(?P<pk>\d+)/notify/$', views.send_notifications),
    url(r'^api/notifications/(?:(?P<pk>\d+)/)?$', views.NotificationAPIView.as_view()),
    url(r'^api/notifications/read/$', views.notifs_set_all_read),
    url(r'^api/users/(?:(?P<pk>\d+)/)?$', views.UserAPIView.as_view()),
    url(r'^api/businesses/$', views.BusinessAPIView.as_view()),
    url(r'^api/home/$', views.HomeAPIView.as_view()),
    url(r'^api/email/(?:(?P<email>(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,})))/)?$', views.EmailAPIView.as_view()),
    url(r'^api/account/$', views.AccountAPIView.as_view()),
    url(r'^api/manager/$', views.ManagerAPIView.as_view()),
    url(r'^api/recent/$', views.RecentAPIView.as_view()),
    url(r'^api/token/$', views.TokenObtainPairView.as_view(), name='token_obtain_pair'),
    url(r'^api/token/refresh/$', TokenRefreshView.as_view(), name='token_refresh'),
    #url(r'^api-auth/', decorator_include(public, 'rest_framework.urls', namespace='rest_framework')),

    # Other
    url(r"^terms-of-service/$", views.InfoView.as_view(template_name='tos.html'), name="tos"),
    url(r"^privacy-policy/$", views.InfoView.as_view(template_name='pp.html'), name="privacy-policy"),
    url(r"^contact/$", views.ContactView.as_view(), name="contact"),
    url(r"^edit\.html$", views.edit_view, name="edit"),
    url(r"^i18n/$", views.i18n_view, name="i18n"),
    url(r"^upload/(?:(?P<pk_b>([\d]+|business))/)?$", views.upload_view, name="upload"),
    url(r'^my-business/$', views.create_business, name="create_business"),
    url(r"^images/(?P<pk>[\d]+)/avatar/(?:(?P<size>(32|48|64))/)?$", views.return_avatar, name="avatar"),
    url(r"^user/(?P<username>[\w.-]+)/$", views.show_profile, name="user_profile"),
    url(r"^(?P<shortname>[\w.-]+)/$", views.show_business, name="business_profile"),
]

urlpatterns += [url('^social/', decorator_include(login_forbidden, 'main.socialaccount_urls'))]


"""from django.conf import settings
from django.views.static import serve
if settings.DEBUG:
    urlpatterns += [url(r'^'+settings.MEDIA_URL[1:]+'(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT, 'show_indexes': True})]"""