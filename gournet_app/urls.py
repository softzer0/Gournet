from django.conf.urls import url
from django.contrib.auth.views import logout
# from django.views.generic.edit import CreateView
from . import views


urlpatterns = [
    url(r'^$', views.home_index, name='home_index'),
    url(r'^signup/$', views.signup, name='signup'),
    url(r'^logout/$', logout, {'next_page': '/'}, name='logout'),
]