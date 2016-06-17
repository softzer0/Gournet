import os.path
from itertools import chain
from django.shortcuts import render, redirect
from django.views.generic import TemplateView
from django.http import HttpResponse
from django.conf import settings
from django.contrib.staticfiles.templatetags.staticfiles import static
from django.utils import timezone
from django.db.models import Case, When, Value, IntegerField
# from django.conf.urls.static import static
# from django.shortcuts import get_object_or_404
# from django.utils import six
# from django.db.models import Q
# from django.views.decorators.csrf import csrf_protect
# from django.core.paginator import Paginator, InvalidPage
from rest_framework.exceptions import NotFound
from django.contrib.auth import get_user_model
from stronghold.decorators import public
from allauth.account import views
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import JSONRenderer
from rest_framework.serializers import ModelSerializer
from allauth.account.models import EmailAddress
from .pagination import PageNumberPagination
from . import serializers
from .models import Relationship, Notification, Business
# from . import permissions
# from . import forms
# from .decorators import login_forbidden
# from collections import OrderedDict
# from decorator_include import decorator_include
# from stronghold.views import StrongholdPublicMixin

User = get_user_model()

def sort_related(query, first=None, others=None):
    """
    @type query: django.db.models.QuerySet
    @type others: django.db.models.QuerySet, chain
    """
    if not others:
        others = first.friends
    if first:
        cases = [When(pk=first.pk, then=Value(0))]
        s = 1
    else:
        cases = []
        s = 0
    cases += [When(pk=obj.pk, then=Value(i+s)) for i, obj in enumerate(others if type(others) is chain else others.all())]
    return query.annotate(rel_objs=Case(*cases, output_field=IntegerField())).order_by('rel_objs')

def get_object(pk, cl=User):
    """
    @type cl: django.db.models.Model
    """
    try:
        return cl.objects.get(pk=pk)
    except:
        raise NotFound(detail=cl.__name__+" not found.") #Response(status=status.HTTP_400_BAD_REQUEST)

@public
def home_index(request):
    if request.user.is_authenticated():
        return TemplateView.as_view(template_name="home.html")(request) # HomePageView.as_view()(request)
    return views.LoginView.as_view(template_name="index.html")(request) # IndexPageView.as_view()(request)

"""class HomePageView(TemplateView):
     template_name = "home.html"

class IndexPageView(LoginView):
     template_name = "index.html"""


def show_business(request, shortname):
    try:
        business = Business.objects.get(shortname=shortname)
    except Business.DoesNotExist:
        return redirect("/")
    if request.user != business.manager:
        if request.user.favourites.filter(pk=business.pk).exists():
            fav_state = 1
        else:
            fav_state = 0
    else:
        fav_state = -1
    return render(request, "view.html", {'business': business, 'fav_state': fav_state})


def show_profile(request, username):
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return redirect("/")
    friends_count = Relationship.objects.filter(from_person__in=user.friends.all(), to_person=user).count()
    if request.user != user:
        rel_state = 0
        if Relationship.objects.filter(from_person=request.user, to_person=user).exists():
            rel_state = 1
        if Relationship.objects.filter(from_person=user, to_person=request.user).exists():
            rel_state += 2
    else:
        rel_state = -1
    return render(request, "user.html", {'user': user, 'friends_count': friends_count, 'rel_state': rel_state})


def return_avatar(request, name, size):
    if request.GET.get('business', None):
        t = 'business'
    else:
        t = 'user'
    fullpath = settings.ROOT_PATH+str(static(settings.IMAGES_PATH))+t+'/'+name+'/avatar'
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
        fullpath = settings.ROOT_PATH+str(static(settings.IMAGES_PATH))+t+'/avatar'+s+'png'
        status = 404
    return HttpResponse(open(fullpath, 'rb').read(), content_type='image/'+mimeext, status=status)


class PasswordChangeView(views.PasswordChangeView):
    def get(self, *args, **kwargs):
        return redirect("/")


class EmailView(views.EmailView):
    def get(self, *args, **kwargs):
        return redirect("/")

class EmailAPIView(generics.ListAPIView):
    serializer_class = serializers.EmailSerializer
    pagination_class = None
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return EmailAddress.objects.filter(user=self.request.user).order_by('-primary', '-verified')


class FriendsAPIView(generics.ListCreateAPIView, generics.DestroyAPIView):
    permission_classes = (IsAuthenticated,)

    def get_serializer_class(self):
        if self.request.method != 'GET':
            return serializers.RelationshipSerializer
        return serializers.UserSerializer

    def get_user(self, pk):
        if pk:
            return get_object(pk)
        return self.request.user

    def get_queryset(self):
        person = self.get_user(self.kwargs['pk'])
        query = User.objects.filter(from_person__from_person__in=person.friends.all(), from_person__to_person=person)
        if person != self.request.user:
            return sort_related(query, self.request.user)
        return query

    def delete(self, request, *args, **kwargs):
        person = self.get_user(kwargs['pk'])
        try:
            Relationship.objects.get(from_person=request.user, to_person=person).delete()
        except:
            raise NotFound(detail="Relationship not found.")
        try:
            rel = Relationship.objects.get(from_person=person, to_person=request.user)
        except:
            pass
        else:
            rel.notification = None
            rel.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationPagination(PageNumberPagination):
    page_size = settings.NOTIFICATION_PAGE_SIZE

class NotificationAPIView(generics.ListAPIView, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = serializers.NotificationSerializer
    pagination_class = NotificationPagination
    permission_classes = (IsAuthenticated,)

    def paginate_queryset(self, queryset):
        if self.request.query_params.get('page', None):
            return super().paginate_queryset(queryset)
        return None

    def get_queryset(self):
        if self.request.query_params.get('page', None):
            return self.request.user.notification_set.filter(unread=False).order_by('-created')
        else:
            rems = self.request.user.reminder_set.filter(when__lte=timezone.now())
            if rems.count() > 0:
                pks = ''
                if rems.count() > 1:
                    for rem in rems[:-1]:
                        pks = rem.event.pk+','
                    text = "You have "+rems.count()+" reminders."
                else:
                    text = "You have one reminder."
                self.request.user.notification_set.add(Notification(text=text, link='#'+pks+rems[-1].pk), bulk=False)
                rems._raw_delete(rems.db)
            last = self.request.query_params.get('last', None)
            if last:
                return self.request.user.notification_set.filter(pk__gt=last, unread=True).order_by('-created')
            return self.request.user.notification_set.filter(unread=True).order_by('-created')

def notifs_set_all_read(request):
    if request.user.is_authenticated():
        try:
            notifs = Notification.objects.filter(pk__in=request.GET['ids'].split(','))
        except:
            status = 400
            text = "Invalid parameter provided."
        else:
            for notif in notifs:
                if notif.unread:
                    notif.unread = False
                    notif.save()
            status = 200
            if request.GET.get('notxt', None):
                text = None
            else:
                text = str(notifs.count())+" notifications have been marked as read."
    else:
        status = 403
        text = "Authentication credentials were not provided."

    if text:
        res = JSONRenderer().render({'detail': text})
    else:
        res = None
    return HttpResponse(res, status=status)


class FavouritesAPIView(generics.ListCreateAPIView, generics.DestroyAPIView):
    permission_classes = (IsAuthenticated,)

    def get_serializer_class(self):
        if self.request.method == 'GET' and self.kwargs['pk'] and not self.request.query_params.get('user', None):
            return serializers.UserSerializer
        return serializers.FavouritesSerializer

    def get_queryset(self):
        pk = self.kwargs['pk']
        if self.request.query_params.get('user', None) and pk and pk != self.request.user.pk:
            person = get_object(pk)
            businesses = Business.objects.filter(manager=self.request.user)
            if businesses.count() > 0:
                return sort_related(person.favourites, businesses[0], chain(businesses[1:], self.request.user.favourites.all()))
            return sort_related(person.favourites, others=self.request.user.favourites)
        if not self.request.query_params.get('user', None) and pk and self.request.method == 'GET':
            business = get_object(pk, Business)
            return sort_related(business.favoured_by, self.request.user)
        return self.request.user.favourites.all()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.user.favourites.add(serializer.validated_data['business'])
        headers = self.get_success_headers(serializer.data)
        return Response(self.get_serializer(serializer.validated_data['business']).data, status=status.HTTP_201_CREATED, headers=headers)

    def destroy(self, request, *args, **kwargs):
        request.user.favourites.remove(kwargs['pk'])
        return Response(status=status.HTTP_204_NO_CONTENT)
