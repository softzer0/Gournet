from django.shortcuts import render, redirect
from django.views.generic import TemplateView
from .models import User
from stronghold.decorators import public
# from . import forms
# from .decorators import login_forbidden
# from decorator_include import decorator_include
# from stronghold.views import StrongholdPublicMixin

@public
def home_index(request):
    if request.user.is_authenticated():
        return TemplateView.as_view(template_name="home.html")(request) # HomePageView.as_view()(request)
    else:
        return TemplateView.as_view(template_name="index.html")(request) # IndexPageView.as_view()(request)

# class HomePageView(TemplateView):
#     template_name = "home.html"

# class IndexPageView(LoginView):
#     template_name = "index.html"


def user(request, name):
    if User.objects.filter(username=name).exists():
        return render(request, "user.html", {"username": name})
    return redirect("/")

