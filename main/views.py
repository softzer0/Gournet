from itertools import chain
from django.shortcuts import render, redirect
from django.views.generic import TemplateView
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.utils import timezone
from django.db.models import Case, When, Value, IntegerField
# from django.conf.urls.static import static
# from django.shortcuts import get_object_or_404
# from django.utils import six
from django.db.models import Q
# from django.views.decorators.csrf import csrf_protect
# from django.core.paginator import Paginator, InvalidPage
from rest_framework.exceptions import NotFound, MethodNotAllowed
from django.contrib.auth import get_user_model
from stronghold.decorators import public
from allauth.account import views
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.renderers import JSONRenderer
from allauth.account.models import EmailAddress
from . import permissions, pagination, serializers
from .models import Relationship, Notification, EventNotification, Business, Like, Comment, Reminder, Item, Event, EVENT_MIN_CHAR
import os.path
# from . import permissions
# from . import forms
# from .decorators import login_forbidden
# from collections import OrderedDict
# from decorator_include import decorator_include
# from stronghold.views import StrongholdPublicMixin
from django.contrib.contenttypes.models import ContentType
from .serializers import NOT_MANAGER_MSG

User = get_user_model()

APP_LABEL = os.path.basename(os.path.dirname(__file__))
def generic_rel_filter(person_id, model, target):
    """
    @type model: django.db.models.Model
    """
    model_name = model.__name__.lower()
    return model.objects.extra(where=['''
        {app_label}_{model}.id in
        (select object_id from {app_label}_{target}
        where content_type_id = {content_type}
            and person_id = {person})'''.format(app_label=APP_LABEL, model=model_name, target=target, content_type=settings.CONTENT_TYPES[model_name].pk, person=person_id)])

def gen_where(model, pk, table=None, additional_obj=None, column=None, target=None):
    col_add = 'person_' if model != 'user' and target == 'relationship' else ''
    target = target or model
    return '''
        {app_label}_{model}.{col_add}id in
        (select {app_label}_{target}.{sel_add}id from {app_label}_{target}
        {inner_join}
        where {column} = {pk})
        {additional}'''.format(app_label=APP_LABEL, model=model, col_add=col_add, sel_add='to_person_' if target == 'relationship' else '', target=target,
                       inner_join='inner join {app_label}{add_user}_{table} on ({app_label}_{target}.id = {app_label}{add_user}_{table}.{on_col}_id)'.format(app_label=APP_LABEL, add_user='_user' if table != 'relationship' else '', table=table, target=target, on_col=target if table != 'relationship' else 'to_person') if table else '',
                       column='main_relationship.from_person_id' if not table or table == 'relationship' else '{app_label}_user_{table}.{column}_id'.format(app_label=APP_LABEL, table=table, column=column or 'user'), pk=pk,
                       additional='or {app_label}_{model}.{col_add}id = {additional_pk}'.format(app_label=APP_LABEL, model=model, col_add=col_add, additional_pk=additional_obj.pk) if additional_obj else '')

def sort_related(query, first=None, where=None):
    """
    @type query: django.db.models.QuerySet
    @type others: django.db.models.QuerySet, chain
    """
    others = query.extra(where=[where if where else gen_where(query.model.__name__.lower(), first, target='relationship')])
    if first:
        cases = [When(pk=first, then=Value(0))]
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
        return TemplateView.as_view(template_name='home.html')(request) # HomePageView.as_view()(request)
    return views.LoginView.as_view(template_name='index.html')(request) # IndexPageView.as_view()(request)

"""class HomePageView(TemplateView):
     template_name = "home.html"

class IndexPageView(LoginView):
     template_name = "index.html"""


def show_business(request, shortname):
    try:
        business = Business.objects.get(shortname=shortname)
    except Business.DoesNotExist:
        return redirect('/')
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
    return render(request, 'view.html', data)


def show_profile(request, username):
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return redirect('/')
    friends_count = Relationship.objects.filter(from_person__in=user.friends.all(), to_person=user).count()
    if request.user != user:
        rel_state = 0
        if Relationship.objects.filter(from_person=request.user, to_person=user).exists():
            rel_state = 1
        if Relationship.objects.filter(from_person=user, to_person=request.user).exists():
            rel_state += 2
    else:
        rel_state = -1
    return render(request, 'user.html', {'user': user, 'friends_count': friends_count, 'rel_state': rel_state})


def return_avatar(request, username_id, size):
    if get_param_bool(request.GET.get('business', False)):
        t = 'business'
    elif get_param_bool(request.GET.get('item', False)):
        t = 'item'
    else:
        t = 'user'
    img_folder = settings.MEDIA_ROOT+'images/'+t+'/'
    avatar = img_folder+username_id+'/avatar'
    s = '.'
    status = None
    if size:
        s += size+'x'+size+'.'
    mimeext = 'png'
    if os.path.isfile(avatar+s+'jpg'):
        avatar += s+'jpg'
        mimeext = 'jpeg'
    elif os.path.isfile(avatar+s+'png'):
        avatar += s+'png'
    else:
        avatar = img_folder+'avatar'+s+'png'
        status = 404
    return HttpResponse(open(avatar, 'rb'), content_type='image/'+mimeext, status=status)


class PasswordChangeView(views.PasswordChangeView):
    def get(self, *args, **kwargs):
        return redirect('/')

class EmailView(views.EmailView):
    def get(self, *args, **kwargs):
        return redirect('/')

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
        qs = User.objects.filter(from_person__from_person__in=person.friends.all(), from_person__to_person=person)
        if person != self.request.user:
            return sort_related(qs, self.request.user.pk)
        return qs #modify for sorting by recent

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
    
    def add_event_notif(self, curr):
        self.request.user.notification_set.add(Notification(text="<a href='/user/%s/'><i>%s %s</i></a> notifies you about %s." % (curr['person'].username, curr['person'].first_name, curr['person'].last_name, "one event" if curr['cnt'] == 1 else str(curr['cnt'])+" events"), link='#/show='+curr['pks'][1:]), bulk=False) #posted by %s (...) "the event" (...) curr['business'].name

    def get_queryset(self):
        if self.request.query_params.get('page', False):
            return self.request.user.notification_set.filter(unread=False)
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
            event_notifies = EventNotification.objects.filter(to_person=self.request.user, is_comment=False)
            if event_notifies.count() > 0:
                curr = {'person': False}
                for notif in event_notifies:
                    if curr['person'] != notif.from_person: #or curr['business'] is not notif.event.business
                        if curr['person']:
                            self.add_event_notif(curr)
                        curr['person'] = notif.from_person
                        #curr['business'] = notif.event.business
                        curr['pks'] = []
                        curr['cnt'] = 0
                    # noinspection PyUnresolvedReferences
                    curr['pks'].append(notif.event.pk)
                    curr['cnt'] += 1
                self.add_event_notif(curr)
                event_notifies._raw_delete(event_notifies.db)
            comment_notifies = [None, None]
            comment_notifies[0] = EventNotification.objects.filter(to_person=self.request.user, is_comment=True)
            if comment_notifies[0].count() > 0:
                for t in [['event', "event", "events"], ['item', "item", "items"]]: #, ['review', "review", "reviews"]
                    comment_notifies[1] = comment_notifies[0].filter(content_type=settings.CONTENT_TYPES[t[0]])
                    if comment_notifies[1].count() > 0:
                        curr = {'pks': [], 'persons': [comment_notifies[1].first().from_person]}
                        # noinspection PyTypeChecker
                        for notif in comment_notifies[1]:
                            if notif.content_object.pk not in curr['pks']:
                                curr['pks'].append(notif.content_object.pk)
                            if notif.from_person != curr['persons'][-1]:
                                curr['persons'].append(notif.from_person)
                        self.request.user.notification_set.add(Notification(text="%s commented on your %s." % ("<a href='/user/%s/'><i>%s %s</i></a> has" % (curr['persons'][0].username, curr['persons'][0].first_name, curr['persons'][0].last_name) if len(curr['persons']) == 1 else str(len(curr['persons']))+" persons have", t[1] if len(curr['pks']) == 1 else str(len(curr['pks']))+" "+t[2]), link='#/show='+','.join(str(v) for v in curr['pks'])), bulk=False)
                        comment_notifies[1]._raw_delete(comment_notifies[1].db)

            last = self.request.query_params.get('last', False)
            if last and last.isdigit():
                return self.request.user.notification_set.filter(pk__gt=last, unread=True)
            return self.request.user.notification_set.filter(unread=True)

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
                status = 404
                text = "Event not found."
            else:
                persons = User.objects.filter(pk__in=ids)
                cnt = 0
                for person in persons:
                    if not EventNotification.objects.filter(from_person=request.user, to_person=person, content_type=ContentType.objects.get_for_model(event), object_id=event.pk).exists():
                        EventNotification.objects.create(from_person=request.user, to_person=person, content_type=ContentType.objects.get_for_model(event), object_id=event.pk)
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
            return sort_related(person.favourites, where=gen_where('business', self.request.user.pk, 'favourites', Business.objects.filter(manager=self.request.user).first()))
        if not is_user and pk:
            business = get_object(pk, Business)
            return sort_related(business.favoured_by, self.request.user.pk)
        return self.request.user.favourites.all() #modify for sorting by recent

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
                    self.kwargs['person'] = person
                else:
                    person = self.request.user
                qs = Event.objects.filter(business__manager=person) | generic_rel_filter(person.pk, Event, 'like')
            else:
                if self.request.method == 'GET' and self.kwargs['pk']:
                    business = get_object(self.kwargs['pk'], Business)
                    qs = business.event_set
                    #self.kwargs['person_business'] = True
                elif self.request.method == 'GET':
                    return Event.objects.all() # change from all to filter current surrounding events
                elif self.kwargs['pk']:
                    return Event.objects.filter(pk=self.kwargs['pk'])
                else:
                    return Event.objects.none()
        return qs.order_by('-when', '-pk')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if 'person' in self.kwargs:
            context['person'] = self.kwargs['person']
        return context


class LikeAPIView(generics.ListCreateAPIView, generics.UpdateAPIView, generics.DestroyAPIView):
    serializer_class = serializers.LikeSerializer

    def __init__(self):
        super().__init__()
        self.permission_classes.append(permissions.IsOwnerOrReadOnly)

    def get_queryset(self):
        if self.kwargs['pk']:
            event = get_object(self.kwargs['pk'], Event)
            qs = Like.objects.filter(content_type=ContentType.objects.get_for_model(event), object_id=event.pk)
            if self.request.query_params.get('is_dislike', False):
                qs = qs.filter(is_dislike=get_param_bool(self.request.query_params['is_dislike']))
            return sort_related(qs, self.request.user.pk)
        elif self.request.method == 'GET':
            raise MethodNotAllowed("No primary key")

    def get_object(self):
        return get_object_or_404(Like, content_type=settings.CONTENT_TYPES['event'], object_id=self.kwargs['pk'], person=self.request.user)


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


class CommentAPIView(generics.ListCreateAPIView, generics.DestroyAPIView):
    serializer_class = serializers.CommentSerializer
    pagination_class = pagination.CommentPagination

    def __init__(self):
        super().__init__()
        self.permission_classes.append(permissions.IsOwnerOrReadOnly)

    def get_queryset(self):
        if self.request.method == 'GET':
            if not self.kwargs['pk']:
                self.pagination_class = pagination.PageNumberPagination
                return Comment.objects.filter(person=self.request.user)
            event = get_object(self.kwargs['pk'], Event)
            qs = Comment.objects.filter(content_type=ContentType.objects.get_for_model(event), object_id=event.pk)
            self.paginator.count = qs.count()
            #if self.request.query_params.get('exclude', False):
            #    qs = qs.exclude(pk__in=[n for n in self.request.query_params.get('exclude').split(',') if n.isdigit()])
            return qs
        if self.kwargs['pk']:
            return Comment.objects.filter(pk=self.kwargs['pk'])

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.pagination_class == pagination.PageNumberPagination:
            context['curruser'] = None
        return context


class ItemAPIView(generics.ListCreateAPIView, generics.UpdateAPIView, generics.DestroyAPIView):
    serializer_class = serializers.ItemSerializer
    pagination_class = None

    def __init__(self):
        super().__init__()
        self.permission_classes.append(permissions.IsOwnerOrReadOnly)

    def get_queryset(self):
        #if self.kwargs['pk']:
        if self.request.method == 'GET':
            if not self.kwargs['pk']:
                try:
                    business = Business.objects.get(manager=self.request.user)
                except:
                    raise NotFound(NOT_MANAGER_MSG)
            else:
                business = get_object(self.kwargs['pk'], Business)
            return Item.objects.filter(business=business)
        if self.kwargs['pk']:
            return Item.objects.filter(pk=self.kwargs['pk'])
        return Item.objects.none()