from django.shortcuts import render, redirect
from django.views.generic import TemplateView
from django.http import HttpResponse
from django.conf import settings
from django.db.models import Q
from django.contrib.staticfiles.templatetags.staticfiles import static
# from django.conf.urls.static import static
# from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from stronghold.decorators import public
from allauth.account import views
from rest_framework import generics
from rest_framework.response import Response
from rest_framework import status
from .serializers import EmailSerializer, RelationshipSerializer
from rest_framework.permissions import IsAuthenticated
from allauth.account.models import EmailAddress
from .models import Relationship
import os.path
# from . import forms
# from .decorators import login_forbidden
# from decorator_include import decorator_include
# from stronghold.views import StrongholdPublicMixin

User = get_user_model()

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
    friends_count = Relationship.objects.filter(Q(person1__in=user.friends.all()) & Q(person2=user)).count()
    if request.user != user:
        rel_state = 0
        if Relationship.objects.filter(Q(person1=request.user) & Q(person2=user)).exists():
            rel_state = 1
        if Relationship.objects.filter(Q(person1=user) & Q(person2=request.user)).exists():
            rel_state += 2
    else:
        rel_state = -1
    return render(request, "user.html", {'user': user, 'friends_count': friends_count, 'rel_state': rel_state})


def return_avatar(request, username, size):
    fullpath = settings.ROOT_PATH+str(static(settings.IMAGES_PATH+username+'/avatar'))
    s = '.'
    status = None
    if size:
        s += size+'x'+size+'.'
    mimeext = 'jpeg'
    if os.path.isfile(fullpath+s+'jpg'):
        fullpath += s+'jpg'
    elif os.path.isfile(fullpath+s+'png'):
        fullpath += s+'png'
        mimeext = 'png'
    else:
        fullpath = settings.ROOT_PATH+str(static(settings.IMAGES_PATH+'avatar'+s+'jpg'))
        status = 404
    return HttpResponse(open(fullpath, 'rb').read(), content_type='image/'+mimeext, status=status)


class EmailAPIView(generics.ListAPIView):
    queryset = EmailAddress.objects.none()
    serializer_class = EmailSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return EmailAddress.objects.filter(user=self.request.user).order_by('-primary', '-verified')


class RelationshipAPIView(generics.ListCreateAPIView, generics.DestroyAPIView):
    queryset = Relationship.objects.none()
    serializer_class = RelationshipSerializer
    permission_classes = (IsAuthenticated,)

    def list(self, request, *args, **kwargs):
        return Response({'friends_list': Relationship.objects.filter(Q(person1__in=request.user.friends.all()) & Q(person2=request.user)).values_list('person1', flat=True)})

    def delete(self, request, *args, **kwargs):
        try:
            Relationship.objects.get(person1=request.user, person2=User.objects.get(pk=kwargs['pk'])).delete()
        except:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        try:
            Relationship.objects.get(person1=User.objects.get(pk=kwargs['pk']), person2=request.user).delete()
        except:
            pass
        return Response(status=status.HTTP_204_NO_CONTENT)


class EmailView(views.EmailView):
    def get(self, *args, **kwargs):
        return redirect("/")

class PasswordChangeView(views.PasswordChangeView):
    def get(self, *args, **kwargs):
        return redirect("/")