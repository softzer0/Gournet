from django.shortcuts import render, redirect
from django.views.generic import TemplateView
from django.contrib.auth import authenticate, login as loginuser
from django.contrib.auth.views import login
from . import forms
from .decorators import ifauth_redir
# from .models import User, Location
# from decorator_include import decorator_include
from stronghold.views import StrongholdPublicMixin
from stronghold.decorators import public
from allauth.account.views import LoginView

@public
def home_index(request):
    if request.user.is_authenticated():
        return HomePageView.as_view()(request)
    else:
        return IndexPageView.as_view()(request)


class HomePageView(TemplateView):
    template_name = 'home.html'


class IndexPageView(LoginView):
    template_name = 'index.html'

