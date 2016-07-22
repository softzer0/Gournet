from itertools import chain
from django.shortcuts import render, redirect
from django.views.generic import TemplateView
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
# from django.conf import settings
from django.utils import timezone
from django.db.models import Case, When, Value, IntegerField
# from django.conf.urls.static import static
# from django.shortcuts import get_object_or_404
# from django.utils import six
from django.db.models import Q
# from django.views.decorators.csrf import csrf_protect
# from django.core.paginator import Paginator, InvalidPage
from rest_framework.exceptions import NotFound, NotAuthenticated
from django.contrib.auth import get_user_model
from stronghold.decorators import public
from allauth.account import views
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.renderers import JSONRenderer
from allauth.account.models import EmailAddress
from . import permissions, pagination, serializers
from .models import Relationship, Notification, Business, Like, Reminder, Event, EVENT_MIN_CHAR
from .templatetags import rawinclude
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
    if others is None:
        others = query.filter(user__in=first.friends.all())
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

def get_param_bool(param):
    if param and param in ['1', 'true', 'True', 'TRUE']:
        return True
    return False


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
        data = {}
    else:
        fav_state = -1
        data = {'minchar': EVENT_MIN_CHAR}
    data['business'] = business
    data['fav_state'] = fav_state
    return render(request, "view.html", data)


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


def return_avatar(request, username_id, size):
    if get_param_bool(request.GET.get('business', False)):
        t = 'business'
    else:
        t = 'user'
    path = 'main/images/'+t+'/'+username_id+'/avatar'
    s = '.'
    status = None
    if size:
        s += size+'x'+size+'.'
    mimeext = 'png'
    if rawinclude.checkstatic(path+s+'jpg'):
        path += s+'jpg'
        mimeext = 'jpeg'
    elif rawinclude.checkstatic(path+s+'png'):
        path += s+'png'
    else:
        path = 'main/images/'+t+'/avatar'+s+'png'
        status = 404
    return HttpResponse(rawinclude.loadstatic(path, 'rb'), content_type='image/'+mimeext, status=status)


class PasswordChangeView(views.PasswordChangeView):
    def get(self, *args, **kwargs):
        return redirect("/")

class EmailView(views.EmailView):
    def get(self, *args, **kwargs):
        return redirect("/")

class EmailAPIView(generics.ListAPIView):
    serializer_class = serializers.EmailSerializer
    pagination_class = None

    def get_queryset(self):
        return EmailAddress.objects.filter(user=self.request.user).order_by('-primary', '-verified')


class FriendsAPIView(generics.ListCreateAPIView, generics.DestroyAPIView):
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


class NotificationAPIView(generics.ListAPIView): #, generics.UpdateAPIView, generics.DestroyAPIView
    serializer_class = serializers.NotificationSerializer
    pagination_class = pagination.NotificationPagination

    def paginate_queryset(self, queryset):
        if self.request.query_params.get('page', False):
            return super().paginate_queryset(queryset)
        return None

    def get_queryset(self):
        if self.request.query_params.get('page', False):
            return self.request.user.notification_set.filter(unread=False).order_by('-created')
        else:
            rems = self.request.user.reminder_set.filter(when__lte=timezone.now())
            if rems.count() > 0:
                pks = ''
                if rems.count() > 1:
                    for i in range(len(rems) - 1):
                        pks = str(rems[i].event.pk)+','
                    text = "You have "+str(rems.count())+" reminders."
                else:
                    text = "You have one reminder."
                self.request.user.notification_set.add(Notification(text=text, link='#/show=%s%s' % (pks, rems.last().event.pk)), bulk=False)
                rems._raw_delete(rems.db)
            if self.request.query_params.get('last', False):
                return self.request.user.notification_set.filter(pk__gt=self.request.query_params.get('last'), unread=True).order_by('-created')
            return self.request.user.notification_set.filter(unread=True).order_by('-created')

def notifs_set_all_read(request):
    if request.user.is_authenticated():
        try:
            notifs = Notification.objects.filter(pk__in=[n for n in request.GET['ids'].split(',') if n.isdigit()])
        except:
            status = 400
            text = "Invalid parameter provided."
        else:
            for notif in notifs:
                if notif.unread:
                    notif.unread = False
                    notif.save()
            status = 200
            if get_param_bool(request.GET.get('notxt', False)):
                text = None
            else:
                text = str(notifs.count())+" notifications have been marked as read."
    else:
        status = 403
        text = "Authentication credentials were not provided."

    if text:
        res = JSONRenderer().render({'detail': text})
    else:
        res = ''
    return HttpResponse(res, status=status)

def send_notifications(request, pk):
    if request.user.is_authenticated():
        try:
            ids = [n for n in request.GET['to'].split(',') if n.isdigit()]
        except:
            status = 400
            text = "Invalid parameter provided."
        else:
            try:
                event = Event.objects.get(pk=pk)
            except:
                status = 400
                text = "Event not found."
            else:
                persons = User.objects.filter(pk__in=ids)
                cnt = 0
                if persons.count() > 0:
                    notif = Notification(text="<a href='/user/"+request.user.username+"/'><i>"+request.user.first_name+"</i></a> notifies you about the event posted by <strong>"+event.business.name+"</strong>.", link="#/show="+str(event.pk))
                    for person in persons:
                        if not person.notification_set.filter(unread=True, text=notif.text).exists():
                            person.notification_set.add(notif, bulk=False)
                            cnt += 1

                status = 200
                if get_param_bool(request.GET.get('notxt', False)):
                    text = None
                else:
                    text = str(cnt)+" persons have been notified."
    else:
        status = 403
        text = "Authentication credentials were not provided."

    if text:
        res = JSONRenderer().render({'detail': text})
    else:
        res = ''
    return HttpResponse(res, status=status)


class FavouritesAPIView(generics.ListCreateAPIView, generics.DestroyAPIView):
    def get_serializer_class(self):
        if self.request.method == 'GET' and self.kwargs['pk'] and not get_param_bool(self.request.query_params.get('user', False)):
            return serializers.UserSerializer
        self.kwargs['notype'] = None
        return serializers.BusinessSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if 'notype' in self.kwargs:
            context['notype'] = None
        return context

    def get_queryset(self):
        pk = self.kwargs['pk']
        is_user = get_param_bool(self.request.query_params.get('user', False))
        if is_user and pk and pk != self.request.user.pk:
            person = get_object(pk)
            businesses = Business.objects.filter(manager=self.request.user)
            return sort_related(person.favourites, others=person.favourites.filter(pk__in=(businesses | self.request.user.favourites.all()).values_list('pk')))
        if not is_user and pk:
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


class EventAPIView(generics.ListCreateAPIView, generics.DestroyAPIView):
    serializer_class = serializers.EventSerializer
    pagination_class = pagination.EventPagination

    def __init__(self):
        super().__init__()
        self.permission_classes.append(permissions.IsOwnerOrReadOnly)

    def get_queryset(self):
        if self.request.query_params.get('ids', False):
            qs = Event.objects.filter(pk__in=[n for n in self.request.query_params.get('ids').split(',') if n.isdigit()])
        else:
            if get_param_bool(self.request.query_params.get('user', False)):
                if self.kwargs['pk']:
                    person = get_object(self.kwargs['pk'], User)
                    #if person != self.request.user:
                    self.kwargs['person_business'] = person
                else:
                    person = self.request.user
                qs = Event.objects.filter(Q(business__manager=person) | Q(like__person=person))
            else:
                if self.request.method == 'GET' and self.kwargs['pk']:
                    business = get_object(self.kwargs['pk'], Business)
                    qs = business.event_set
                    #self.kwargs['person_business'] = True
                else:
                    qs = Event.objects.all().order_by('-when', '-id') # change from all to filter current surrounding events
        return qs.order_by('-when', '-id')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if 'person_business' in self.kwargs:
            context['person_business'] = self.kwargs['person_business']
        return context


class LikeAPIView(generics.ListCreateAPIView, generics.UpdateAPIView, generics.DestroyAPIView):
    serializer_class = serializers.LikeSerializer

    def __init__(self):
        super().__init__()
        self.permission_classes.append(permissions.IsOwnerOrReadOnly)

    def get_queryset(self):
        event = get_object(self.kwargs['pk'], Event)
        qs = Like.objects.filter(event=event)
        if self.request.query_params.get('is_dislike', False):
            qs = qs.filter(is_dislike=get_param_bool(self.request.query_params['is_dislike']))
        return sort_related(qs, self.request.user, qs.filter(person__in=self.request.user.friends.all()))

    def get_object(self):
        return get_object_or_404(Like, event__pk=self.kwargs['pk'], person=self.request.user)


class ReminderAPIView(generics.ListCreateAPIView, generics.DestroyAPIView):
    serializer_class = serializers.ReminderSerializer

    def __init__(self):
        super().__init__()
        self.permission_classes.append(permissions.IsOwnerOrReadOnly)

    def get_queryset(self):
        if self.kwargs['pk']:
            person = get_object(self.kwargs['pk'], User)
        else:
            person = self.request.user
        return Reminder.objects.filter(person=person)
