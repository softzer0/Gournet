from django.shortcuts import render, redirect
from django.views.generic import TemplateView
from django.http import HttpResponse
from django.conf import settings
from django.db.models import Q
from django.contrib.staticfiles.templatetags.staticfiles import static
# from django.conf.urls.static import static
# from django.shortcuts import get_object_or_404
# from django.utils import six
# from rest_framework.exceptions import NotFound
# from django.views.decorators.csrf import csrf_protect
from django.contrib.auth import get_user_model
from django.core.paginator import Paginator, InvalidPage
from stronghold.decorators import public
from allauth.account import views
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .pagination import PageNumberPagination
from allauth.account.models import EmailAddress
from .serializers import EmailSerializer, RelationshipSerializer, NotificationSerializer
from .models import Relationship, Notification
import os.path
from collections import OrderedDict
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


class RelationshipPagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 1000

class RelationshipAPIView(generics.ListCreateAPIView, generics.DestroyAPIView):
    queryset = Relationship.objects.none()
    serializer_class = RelationshipSerializer
    pagination_class = RelationshipPagination
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return Relationship.objects.filter(Q(person1__in=self.request.user.friends.all()) & Q(person2=self.request.user))

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset()).values_list('person1', flat=True)
        data = OrderedDict()

        page = self.paginate_queryset(queryset)
        if page is not None:
            data['frieds_list'] = page
            return self.get_paginated_response(data)

        return Response({'friends_list': queryset})

    def delete(self, request, *args, **kwargs):
        person = User.objects.get(pk=kwargs['pk'])
        try:
            Relationship.objects.get(person1=request.user, person2=person).delete()
        except:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        try:
            rel = Relationship.objects.get(person1=person, person2=request.user)
        except:
           pass
        else:
            rel.notification = None
            rel.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationPagination(PageNumberPagination):
    page_size = settings.NOTIFICATION_PAGE_SIZE
    page_size_query_param = 'page_size'
    max_page_size = 1000

class NotificationAPIView(generics.ListAPIView, generics.RetrieveUpdateDestroyAPIView):
    queryset = Notification.objects.none()
    serializer_class = NotificationSerializer
    pagination_class = NotificationPagination
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return self.request.user.notification_set.order_by('-unread', '-created')

def notifs_set_all_read(request, page_number):
    # invalid_page_message = 'Invalid page.'

    paginator = Paginator(request.user.notification_set.order_by('-unread', '-created'), settings.NOTIFICATION_PAGE_SIZE)
    if page_number == 'last':
        page_number = paginator.num_pages

    try:
        page = paginator.page(page_number)
    except InvalidPage:
        status = 404
        """msg = invalid_page_message.format(
            page_number=page_number, message=six.text_type(exc)
        )
        raise NotFound(msg)"""
    else:
        for notif in page.object_list:
            notif.unread = False
            notif.save()
        status = 200

    if request.is_ajax():
        return redirect('/api/notifications/?page='+str(page_number)+'&format=json', status=status)
    else:
        return redirect('/api/notifications/?page='+str(page_number), status=status)


class EmailView(views.EmailView):
    def get(self, *args, **kwargs):
        return redirect("/")

class PasswordChangeView(views.PasswordChangeView):
    def get(self, *args, **kwargs):
        return redirect("/")