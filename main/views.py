from django.shortcuts import render, redirect
from django.views.generic import TemplateView
from django.http import HttpResponse
from django.conf import settings
# from django.conf.urls.static import static
from .models import User
from stronghold.decorators import public
from allauth.account import views
from rest_framework import generics
from .serializers import EmailSerializer
from rest_framework.permissions import IsAuthenticated
from allauth.account.models import EmailAddress
import os.path
# from . import forms
# from .decorators import login_forbidden
# from decorator_include import decorator_include
# from stronghold.views import StrongholdPublicMixin

@public
def home_index(request):
    if request.user.is_authenticated():
        return TemplateView.as_view(template_name="home.html")(request) # HomePageView.as_view()(request)
    else:
        return views.LoginView.as_view(template_name="index.html")(request) # IndexPageView.as_view()(request)

# class HomePageView(TemplateView):
#     template_name = "home.html"

# class IndexPageView(LoginView):
#     template_name = "index.html"


def show_profile(request, username):
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return redirect("/")
    return render(request, "user.html", {'user': user})


def return_avatar(request, username, size):
    fullpath = settings.IMAGES_PATH+username+'/avatar'
    s = '.'
    if size:
        s += size+'x'+size+'.'
    mimeext = 'jpeg'
    if os.path.isfile(fullpath+s+'jpg'):
        fullpath += s+'jpg'
    elif os.path.isfile(fullpath+s+'png'):
        fullpath += s+'png'
        mimeext = 'png'
    else:
        fullpath = settings.IMAGES_PATH+'avatar'+s+'jpg'
    return HttpResponse(open(fullpath, 'rb').read(), content_type='image/'+mimeext)


class EmailAPIView(generics.ListAPIView):
    queryset = EmailAddress.objects.none()
    serializer_class = EmailSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return EmailAddress.objects.filter(user=self.request.user).order_by('-primary', '-verified')


class EmailView(views.EmailView):
    def get(self, *args, **kwargs):
        return redirect("/")

class PasswordChangeView(views.PasswordChangeView):
    def get(self, *args, **kwargs):
        return redirect("/")