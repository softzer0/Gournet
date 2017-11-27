from django.conf.urls import url
from allauth.account.views import signup, logout, account_inactive, email_verification_sent, confirm_email, \
    password_reset, password_reset_done, password_reset_from_key, password_reset_from_key_done
from rest_auth.views import PasswordChangeView, PasswordResetView, PasswordResetConfirmView
# from django.views.generic.edit import CreateView
# from django.views.generic import TemplateView
from decorator_include import decorator_include
from . import views
from stronghold.decorators import public
from .decorators import login_forbidden

urlpatterns = [
    # Allauth related

    url(r"^signup/$", public(views.basenohf), {'': signup}, name="account_signup"),
    url(r"^$", views.home_index, name="account_login"),
    url(r"^logout/$", logout, name="account_logout"),

    url(r"^inactive/$", account_inactive, name="account_inactive"),

    # E-mail
    #url(r"^email/$", views.EmailView.as_view(), name="account_email"),
    url(r"^email/confirm/$", email_verification_sent,
        name="account_email_verification_sent"),
    url(r"^email/confirm/(?P<key>[-:\w]+)/$", confirm_email,
        name="account_confirm_email"),

    # password reset
    url(r"^password/reset/$", password_reset,
        name="account_reset_password"),
    url(r"^password/reset/done/$", password_reset_done,
        name="account_reset_password_done"),
    url(r"^password/reset/key/(?P<uidb36>[0-9A-Za-z]+)-(?P<key>.+)/$",
        password_reset_from_key,
        name="account_reset_password_from_key"),
    url(r"^password/reset/key/done/$", password_reset_from_key_done,
        name="account_reset_password_from_key_done"),

    # API
    url(r'^api/feed/$', views.FeedAPIView.as_view()),
    url(r'^api/items/(?:(?P<pk>\d+)/)?$', views.ItemAPIView.as_view()),
    url(r'^api/comments/(?:(?P<pk>\d+)/)?$', views.CommentAPIView.as_view()),
    url(r'^api/reminders/(?:(?P<pk>\d+)/)?$', views.ReminderAPIView.as_view()),
    url(r'^api/likes/(?:(?P<pk>\d+)/)?$', views.like_switch_view),
    url(r'^api/events/(?:(?P<pk>\d+)/)?$', views.EventAPIView.as_view()),
    url(r'^api/events/(?P<pk>\d+)/notify/$', views.SendNotifsAPIView.as_view()),
    url(r'^api/notifications/(?:(?P<pk>\d+)/)?$', views.NotificationAPIView.as_view()),
    url(r'^api/notifications/read/$', views.SetNotifsReadAPIView.as_view()),
    url(r'^api/users/(?:(?P<pk>\d+)/)?$', views.UserAPIView.as_view()),
    url(r'^api/business/(?:(?P<pk>\d+)/)?$', views.BusinessAPIView.as_view()),
    url(r'^api/home/$', views.HomeAPIView.as_view()),
    url(r'^api/recent/$', views.RecentAPIView.as_view()),
    url(r"^images/(?P<type>user|business|item)/(?:(?P<pk>[\d]+)/)?avatar/(?:(?P<size>(32|48|64))/)?$", views.ImageAPIView.as_view(), name="avatar"),
    url(r"^api/upload/(?:(?P<pk_b>([\d]+|business))/)?avatar/$", views.UploadAPIView.as_view(), name="upload"),
    url(r'^api/token/$', views.TokenObtainPairView.as_view()),
    url(r'^api/token/refresh/$', views.TokenRefreshView.as_view()),
    #url(r'^api-auth/', decorator_include(public, 'rest_framework.urls', namespace='rest_framework')),

    # Rest-auth related
    url(r'^api/email/(?:(?P<email>(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,})))/)?$', views.EmailAPIView.as_view()),
    url(r'^api/password/$', PasswordChangeView.as_view()),
    url(r'^api/password/reset/$', PasswordResetView.as_view(),
        name='rest_password_reset'),
    url(r'^api/password/reset/confirm/$', PasswordResetConfirmView.as_view(),
        name='rest_password_reset_confirm'),

    # Other
    url(r"^terms-of-service/$", views.InfoView.as_view(template_name='tos.html'), name="tos"),
    url(r"^privacy-policy/$", views.InfoView.as_view(template_name='pp.html'), name="privacy-policy"),
    url(r"^contact/$", views.ContactView.as_view(), name="contact"),
    url(r"^edit\.html$", views.edit_view, name="edit"),
    url(r"^i18n/$", views.i18n_view, name="i18n"),
    url(r'^my-business/$', views.create_business, name="create_business"),
    url(r"^user/(?P<username>[\w.-]+)/$", views.show_profile, name="user_profile"),
    url(r"^(?P<shortname>[\w.-]+)/$", views.show_business, name="business_profile"),
]

urlpatterns += [url('^social/', decorator_include(login_forbidden, 'main.socialaccount_urls'))]


"""from django.conf import settings
from django.views.static import serve
if settings.DEBUG:
    urlpatterns += [url(r'^'+settings.MEDIA_URL[1:]+'(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT, 'show_indexes': True})]"""