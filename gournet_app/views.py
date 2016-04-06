from django.shortcuts import render, redirect
from django.views.generic import TemplateView
from django.contrib.auth import authenticate, login as loginuser
from django.contrib.auth.views import login
from . import forms
from .decorators import ifauth_redir
# from .models import User, Location
from stronghold.decorators import public


@public
def home_index(request):
    if request.user.is_authenticated():
        return HomePageView.as_view()(request)
    else:
        return login(request, template_name='index.html')


class HomePageView(TemplateView):
    template_name = 'home.html'


@public
@ifauth_redir
def signup(request):
    reg_form = forms.RegistrationForm(request.POST or None)
    loc_form = forms.LocationForm(request.POST or None)
    if request.method == "POST":
        if reg_form.is_valid():
            reg = reg_form.save(commit=False)
            if loc_form.is_valid():
                reg.location = loc_form.save()
                reg.save()
                new_user = authenticate(username=reg_form.cleaned_data['username'],
                                        password=reg_form.cleaned_data['password1'])
                loginuser(request, new_user)
                return redirect('/')
    return render(request, 'signup.html', {'loc_form': loc_form, 'reg_form': reg_form})
