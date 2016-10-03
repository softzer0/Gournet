from django.shortcuts import render, redirect
from django.views.generic import TemplateView
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.utils import timezone
from django.db.models import Case, When, Value, IntegerField
# from django.conf.urls.static import static
# from django.shortcuts import get_object_or_404
# from django.db.models import Q
# from django.views.decorators.csrf import csrf_protect
# from django.core.paginator import Paginator, InvalidPage
# from itertools import chain
from rest_framework.exceptions import NotFound, MethodNotAllowed
from django.contrib.auth import get_user_model
from stronghold.decorators import public
from allauth.account import views
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.renderers import JSONRenderer
from allauth.account.models import EmailAddress
from . import permissions, pagination, serializers
from rest_framework.serializers import ValidationError
from .models import Relationship, Notification, EventNotification, Business, Like, Comment, Reminder, Item, Event, EVENT_MIN_CHAR, CONTENT_TYPES_PK
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
def generic_rel_filter(pk, model, target, swap=None, ct=None):
    """
    @type model: django.db.models.Model
    """
    model_name = model.__name__.lower()
    return model.objects.extra(where=['''
        {app_label}_{model}.id in
        (select {sel}_id from {app_label}_{target}
        where content_type_id = {content_type}
            and {column}_id = {pk})
        {additional}'''.format(app_label=APP_LABEL, model=model_name, sel='object' if not swap else 'person', target=target, content_type=settings.CONTENT_TYPES[model_name].pk if not swap else settings.CONTENT_TYPES[swap].pk, column='person' if not swap else 'object', pk=pk,
                       additional='and {app_label}_{model}.content_type_id = {ct}'.format(app_label=APP_LABEL, model=model_name, ct=ct) if ct else '')])

def gen_where(model, pk, table=None, additional_obj=None, column=None, target=None, ct=None):
    col_add = 'person_' if model != 'user' and target == 'relationship' else ''
    target = target or model
    return '''
        {app_label}_{model}.{col_add}id in
        (select {app_label}_{target}.{sel_add}id from {app_label}_{target}
        {inner_join}
        where {content_type}
            {column} = {pk})
        {additional}'''.format(app_label=APP_LABEL, model=model, col_add=col_add, sel_add='to_person_' if target == 'relationship' else '', target=target,
                       inner_join='inner join {app_label}{add_user}_{table} on ({app_label}_{target}.id = {app_label}{add_user}_{table}.{on_col}_id)'.format(app_label=APP_LABEL, add_user='_user' if table != 'relationship' and not column else '', table=table, target=target, on_col='to_person' if table == 'relationship' else 'object' if column == 'person' else 'person' if target == 'user' else target) if table else '',
                       content_type='{app_label}_{table}.content_type_id = {ct} and'.format(app_label=APP_LABEL, table=table, ct=ct) if ct else '',
                       column='main_relationship.from_person_id' if not table or table == 'relationship' else '{app_label}{add_user}_{table}.{column}_id'.format(app_label=APP_LABEL, add_user = '_user' if model != 'user' and column != 'person' else '', table=table, column=column or 'user'), pk=pk,
                       additional='or {app_label}_{model}.{col_add}id = {additional_pk}'.format(app_label=APP_LABEL, model=model, col_add=col_add, additional_pk=additional_obj.pk) if additional_obj else '')

def sort_related(query, first=None, where=None):
    """
    @type query: django.db.models.QuerySet
    """
    others = query.extra(where=[where if where else gen_where(query.model.__name__.lower(), first, target='relationship')])
    if first:
        cases = [When(pk=first, then=Value(0))]
        s = 1
    else:
        cases = []
        s = 0
    cases += [When(pk=obj.pk, then=Value(i+s)) for i, obj in enumerate(others.all())]
    return query.annotate(rel_objs=Case(*cases, output_field=IntegerField())).order_by('rel_objs')

def get_object(pk, cl=User):
    """
    @type cl: django.db.models.Model
    """
    try:
        return cl.objects.get(pk=pk)
    except:
        raise NotFound(cl.__name__+" not found.") #Response(status=status.HTTP_400_BAD_REQUEST)

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
        data = {'business': Business.objects.get(shortname=shortname)}
    except Business.DoesNotExist:
        return redirect('/')
    data['fav_count'] = Like.objects.filter(content_type=settings.CONTENT_TYPES['business'], object_id=data['business'].pk).count()
    if request.user != data['business'].manager:
        if Like.objects.filter(content_type=settings.CONTENT_TYPES['business'], object_id=data['business'].pk, person=request.user).exists():
            data['fav_state'] = 1
        else:
            data['fav_state'] = 0
        data['minchar'] = serializers.REVIEW_MIN_CHAR
    else:
        data['fav_state'] = -1
        data['minchar'] = EVENT_MIN_CHAR
    return render(request, 'view.html', data)


def show_profile(request, username):
    try:
        data = {'user': User.objects.get(username=username)}
    except User.DoesNotExist:
        return redirect('/')
    data['friends_count'] = Relationship.objects.filter(from_person__in=data['user'].friends.all(), to_person=data['user']).count()
    if request.user != data['user']:
        data['rel_state'] = 0
        if Relationship.objects.filter(from_person=request.user, to_person=data['user']).exists():
            data['rel_state'] = 1
        if Relationship.objects.filter(from_person=data['user'], to_person=request.user).exists():
            data['rel_state'] += 2
    else:
        data['rel_state'] = -1
    return render(request, 'user.html', data)


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


class BaseAuthView():
    success_url = '/'

    def get(self, *args, **kwargs):
        return redirect('/')

    def post(self, request, *args, **kwargs):
        request.is_ajax = lambda: True
        # noinspection PyUnresolvedReferences
        return super().post(request, *args, **kwargs)

class PasswordChangeView(BaseAuthView, views.PasswordChangeView):
    pass

class EmailView(BaseAuthView, views.EmailView):
    pass

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
            raise NotFound("Relationship not found.")
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
        if 'page' in self.request.query_params:
            return super().paginate_queryset(queryset)
        return None
    
    def add_event_notif(self, curr, when):
        self.request.user.notification_set.add(Notification(text="<a href=\"/user/%s/\"><i>%s %s</i></a> notifies you about %s." % (curr['person'].username, curr['person'].first_name, curr['person'].last_name, "one event" if curr['cnt'] == 1 else str(curr['cnt'])+" events"), link='#/show='+curr['pks'][1:]+'&type=event', created=when), bulk=False) #posted by %s (...) "the event" (...) curr['business'].name

    def get_queryset(self):
        if 'page' in self.request.query_params:
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
                self.request.user.notification_set.add(Notification(text=text, link='#/show=%s%s&type=event' % (pks, rems.last().event.pk)), bulk=False)
                rems._raw_delete(rems.db)
            event_notifies = EventNotification.objects.filter(to_person=self.request.user, is_comment=False)
            if event_notifies.count() > 0:
                curr = {'person': False}
                for notif in event_notifies:
                    if curr['person'] != notif.from_person: #or curr['business'] is not notif.event.business
                        if curr['person']:
                            self.add_event_notif(curr, notif.created)
                        curr['person'] = notif.from_person
                        #curr['business'] = notif.event.business
                        curr['pks'] = ''
                        curr['cnt'] = 0
                    # noinspection PyUnresolvedReferences
                    curr['pks'] += ','+str(notif.content_object.pk)
                    curr['cnt'] += 1
                # noinspection PyUnboundLocalVariable
                self.add_event_notif(curr, notif.created)
                event_notifies._raw_delete(event_notifies.db)
            comment_notifies = [None, None]
            comment_notifies[0] = EventNotification.objects.filter(to_person=self.request.user, is_comment=None)
            if comment_notifies[0].count() > 0:
                curr = {'pks': [], 'persons': []}
                # noinspection PyTypeChecker
                for notif in comment_notifies[0]:
                    curr['pks'].append(notif.content_object.pk)
                    curr['persons'].append(notif.from_person)
                self.request.user.notification_set.add(Notification(text="%s reviewed your business." % ("<a href='/user/%s/'><i>%s %s</i></a> has" % (curr['persons'][0].username, curr['persons'][0].first_name, curr['persons'][0].last_name) if len(curr['persons']) == 1 else str(len(curr['persons']))+" persons have"), link='#/show='+','.join(str(v) for v in curr['pks'])+'&type=review', created=notif.created), bulk=False)
                comment_notifies[0]._raw_delete(comment_notifies[0].db)
            comment_notifies[0] = EventNotification.objects.filter(to_person=self.request.user, is_comment=True)
            if comment_notifies[0].count() > 0:
                for t in [['event', "your event", "your events"], ['item', "your item", "your items"], ['comment', ["a review on your business", "your review"], "reviews on your business"]]:
                    comment_notifies[1] = comment_notifies[0].filter(content_type=settings.CONTENT_TYPES[t[0]])
                    if comment_notifies[1].count() > 0:
                        curr = {'pks': [], 'persons': [comment_notifies[1].first().from_person]}
                        # noinspection PyTypeChecker
                        for notif in comment_notifies[1]:
                            if notif.content_object.pk not in curr['pks']:
                                curr['pks'].append(notif.content_object if t[0] == 'comment' else notif.content_object.pk)
                            if notif.from_person != curr['persons'][-1]:
                                curr['persons'].append(notif.from_person)
                        self.request.user.notification_set.add(Notification(text="%s commented on %s." % ("<a href='/user/%s/'><i>%s %s</i></a> has" % (curr['persons'][0].username, curr['persons'][0].first_name, curr['persons'][0].last_name) if len(curr['persons']) == 1 else str(len(curr['persons']))+" persons have", (t[1] if t[0] != 'comment' else t[1][0] if self.request.user == curr['pks'][0].content_object.manager else t[1][1]) if len(curr['pks']) == 1 else str(len(curr['pks']))+" "+t[2]), link='#/show='+','.join(str(v.pk if t[0] == 'comment' else v) for v in curr['pks'])+'&type='+(t[0] if t[0] != 'comment' else 'review')+('&showcomments' if len(curr['pks']) == 1 else ''), created=notif.created), bulk=False)
                        comment_notifies[1]._raw_delete(comment_notifies[1].db)

            last = self.request.query_params.get('last', False)
            if last and last.isdigit():
                return self.request.user.notification_set.filter(pk__gt=last, unread=True)
            return self.request.user.notification_set.filter(unread=True)

def base_view(request, t, cont, **kwargs):
    notxt = get_param_bool(request.GET.get('notxt', False))
    if request.user.is_authenticated():
        try:
            objpks = t()
        except:
            status = 400
            text = "Invalid parameter provided." if not notxt else None
        else:
            status, text = cont(objpks, notxt, **kwargs)
    else:
        status = 403
        text = "Authentication credentials were not provided." if not notxt else None

    res = JSONRenderer().render({'detail': text}) if text else ''
    return HttpResponse(res, status=status)

def notifs_set_all_read(request):
    def t():
        return Notification.objects.filter(pk__in=[n for n in request.GET['ids'].split(',') if n.isdigit()])
    def cont(objpks, notxt, **kwargs):
        for notif in objpks:
            if notif.unread:
                notif.unread = False
                notif.save()
        return 200, str(objpks.count())+" notifications have been marked as read." if not notxt else None
    return base_view(request, t, cont)

def send_notifications(request, pk):
    def t():
        return [n for n in request.GET['to'].split(',') if n.isdigit()]
    def cont(objpks, notxt, **kwargs):
        try:
            event = Event.objects.get(pk=kwargs['pk'])
        except:
            status = 404
            text = "Event not found." if not notxt else None
        else:
            persons = User.objects.filter(pk__in=objpks)
            if not notxt:
                cnt = 0
            for person in persons:
                if request.user != person and not EventNotification.objects.filter(from_person=request.user, to_person=person, content_type=ContentType.objects.get_for_model(event), object_id=event.pk).exists():
                    EventNotification.objects.create(from_person=request.user, to_person=person, content_type=ContentType.objects.get_for_model(event), object_id=event.pk)
                    if not notxt:
                        # noinspection PyUnboundLocalVariable
                        cnt += 1
            status = 200
            # noinspection PyUnboundLocalVariable
            text = str(cnt)+" persons have been notified." if not notxt else None
        return status, text
    return base_view(request, t, cont, pk=pk)


class BaseAPIView(generics.ListCreateAPIView, generics.DestroyAPIView):
    pagination_class = pagination.EventPagination
    filter = 'business__manager'
    additional_filters = None
    order_by = None
    order_by_noperson = None

    def __init__(self):
        super().__init__()
        self.permission_classes.append(permissions.IsOwnerOrReadOnly)

    def get_person_qs(self, person):
        f = {self.filter: person}
        if self.additional_filters:
            f.update(self.additional_filters)
        return self.model.objects.filter(**f) | generic_rel_filter(person.pk, self.model, 'like', ct=self.additional_filters['content_type'].pk if self.additional_filters and 'content_type' in self.additional_filters else None)

    def get_qs_pk(self):
        business = get_object(self.kwargs['pk'], Business)
        return self.model.objects.filter(business=business)

    def order_qs(self, qs):
        # noinspection PyArgumentList,PyUnboundLocalVariable
        if self.order_by_noperson and not get_param_bool(self.request.query_params.get('is_person', False)):
            order_by = self.order_by_noperson
        else:
            order_by = self.order_by
        return qs.order_by(*order_by) if order_by else qs

    def get_queryset(self):
        if 'ids' in self.request.query_params:
            qs = self.model.objects.filter(pk__in=[n for n in self.request.query_params.get('ids').split(',') if n.isdigit()])
        else:
            if get_param_bool(self.request.query_params.get('is_person', False)):
                if self.kwargs['pk']:
                    person = get_object(self.kwargs['pk'], User)
                    #if person != self.request.user:
                    self.kwargs['person'] = person
                else:
                    person = self.request.user
                qs = self.get_person_qs(person)
            else:
                if self.request.method == 'GET' and self.kwargs['pk']:
                    qs = self.get_qs_pk()
                    #self.kwargs['person_business'] = True
                elif self.request.method == 'GET':
                    return self.getnopk()
                elif self.kwargs['pk']:
                    return self.model.objects.filter(pk=self.kwargs['pk'])
                else:
                    return self.model.objects.none()
        return self.order_qs(qs)

    def paginate_queryset(self, queryset):
        if 'ids' not in self.request.query_params:
            return super().paginate_queryset(queryset)
        return None

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if 'person' in self.kwargs:
            context['person'] = self.kwargs['person']
        return context

def get_t_pk(obj, dic):
    """
    @type obj: django.views.generic.base.View
    """
    if 'ct_pk' not in obj.kwargs:
        obj.kwargs['ct_pk'] = obj.request.data.get('content_type', None) or obj.request.query_params.get('content_type', None)
        if obj.kwargs['ct_pk'] and not isinstance(obj.kwargs['ct_pk'], int) and not obj.kwargs['ct_pk'].isdigit():
            obj.kwargs['ct_pk'] = None
    pk = obj.kwargs['ct_pk']
    if pk:
        if int(pk) in dic:
            return pk if dic != settings.HAS_STARS else True
        return False if dic != settings.HAS_STARS else int(pk)
    return None

def get_type(obj):
    """
    @type obj: django.views.generic.base.View
    """
    if 'ct' not in obj.kwargs:
        pk = get_t_pk(obj, CONTENT_TYPES_PK)
        if pk:
            res = ContentType.objects.get(pk=pk)
        elif pk is False:
            raise NotFound("Content type not found.")
        else:
            res = False
        obj.kwargs['ct'] = res
        return res
    return obj.kwargs['ct']

def get_qs(obj_v, model):
    """
    @type obj_v: django.views.generic.base.View
    """
    ct = get_type(obj_v)
    obj = get_object(obj_v.kwargs['pk'], ct.model_class() if ct else Event)
    return model.objects.filter(content_type=ct if ct else settings.CONTENT_TYPES['event'], object_id=obj.pk)

def set_t(obj_v, context=None):
    """
    @type obj_v: django.views.generic.base.View
    """
    pk = get_t_pk(obj_v, settings.HAS_STARS)
    obj = context if context else obj_v.kwargs
    if pk is True:
        obj['stars'] = None
    elif pk == settings.CONTENT_TYPES['business'].pk:
        obj['business'] = None
    else:
        return False
    return True

class CommentAPIView(BaseAPIView):
    serializer_class = serializers.CommentSerializer
    pagination_class = pagination.CommentPagination
    model = Comment
    filter = 'person'
    additional_filters = {'content_type': settings.CONTENT_TYPES['business']}
    order_by = ['-pk']

    def get_person_qs(self, person):
        self.pagination_class = pagination.PageNumberPagination
        return super().get_person_qs(person)

    def getnopk(self):
        return self.order_qs(self.get_person_qs(self.request.user))

    def get_qs_pk(self):
        self.order_by_noperson = ['created' if get_param_bool(self.request.query_params.get('reverse', False)) else '-created']
        return get_qs(self, Comment)

    def order_qs(self, qs):
        qs = super().order_qs(qs)
        self.get_serializer_context(True)
        if 'business' in self.kwargs['context'] and not self.request.query_params.get('ids', False):
            qs = qs.annotate(curruser=Case(When(person=self.request.user, then=Value(0)), output_field=IntegerField())).order_by('-curruser')
        return qs

    def get_serializer_context(self, kw=False):
        if 'context' not in self.kwargs:
            context = super().get_serializer_context()
            if 'person' not in context and not set_t(self, context) and (get_param_bool(self.request.query_params.get('is_person', False)) or not self.kwargs['pk'] or self.request.query_params.get('ids', False)):
                context['ids' if self.request.query_params.get('ids', False) else 'curruser' if not self.kwargs['pk'] else 'business'] = None
            if kw:
                self.kwargs['context'] = context
        else:
            context = self.kwargs['context']
        if not kw:
            return context

    def delete(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.status is not None and obj.content_object.main_comment == obj:
            co = obj.content_object
            obj.delete()
            co.main_comment = Comment.objects.filter(content_type=settings.CONTENT_TYPES['comment'], object_id=co.pk, status__isnull=False).last()
            if co.main_comment:
                co.save()
                return Response(data=serializers.CommentSerializer(co.main_comment, context=self.get_serializer_context()).data)
        else:
            obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class EventAPIView(BaseAPIView):
    serializer_class = serializers.EventSerializer
    model = Event
    order_by = ['-when', '-pk']

    def getnopk(self):
        return Event.objects.all() # change from all to filter current surrounding events

def get_b_manager(user):
    try:
        return Business.objects.get(manager=user)
    except:
        raise NotFound(NOT_MANAGER_MSG)

class ItemAPIView(BaseAPIView):
    serializer_class = serializers.ItemSerializer
    model = Item

    def getnopk(self):
        return Item.objects.filter(business=get_b_manager(self.request.user))

    def get_queryset(self):
        qs = super().get_queryset()
        if get_param_bool(self.request.query_params.get('menu', False)):
            qs = qs.order_by('name', 'category')
        return qs

    def paginate_queryset(self, queryset):
        if not get_param_bool(self.request.query_params.get('menu', False)):
            return super().paginate_queryset(queryset)
        return None

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if 'ids' not in self.request.query_params and not get_param_bool(self.request.query_params.get('is_person', False)):
            if get_param_bool(self.request.query_params.get('menu', False)):
                context['menu'] = None
            else:
                context['hiddenbusiness'] = None
        return context

    def delete(self, request, *args, **kwargs):
        obj = self.get_object()
        if Item.objects.filter(business=obj.business).count() == 1:
            raise ValidationError({'non_field_errors': ["The last remaining item can't be deleted."]})
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class LikeAPIView(generics.ListCreateAPIView, generics.UpdateAPIView, generics.DestroyAPIView):
    def __init__(self):
        super().__init__()
        self.permission_classes.append(permissions.IsOwnerOrReadOnly)

    def get_serializer_class(self):
        if self.request.method == 'GET':
            if get_param_bool(self.request.query_params.get('is_person', False)) and get_type(self) and self.kwargs['ct'].model == 'business':
                self.kwargs['notype'] = None
                return serializers.BusinessSerializer
            if get_type(self) and self.kwargs['ct'].model == 'business' or not self.kwargs['pk']:
                return serializers.UserSerializer
        return serializers.LikeSerializer

    def get_queryset(self):
        if not self.kwargs['pk'] or get_type(self) and self.kwargs['ct'].model == 'business':
            pk = self.kwargs['pk']
            is_user = get_param_bool(self.request.query_params.get('is_person', False))
            if is_user:
                if pk and pk != self.request.user.pk:
                    person = get_object(pk)
                    return sort_related(generic_rel_filter(person.pk, Business, 'like'), where=gen_where('business', self.request.user.pk, 'like', Business.objects.filter(manager=self.request.user).first(), 'person', ct=settings.CONTENT_TYPES['business'].pk))
                return generic_rel_filter(self.request.user.pk, Business, 'like') #modify for sorting by recent
            business = get_object(pk, Business) if pk else get_b_manager(self.request.user)
            return sort_related(generic_rel_filter(business.pk, User, 'like', 'business'), where=gen_where('user', business.pk, 'like', self.request.user, 'object', ct=settings.CONTENT_TYPES['business'].pk))
        qs = get_qs(self, Like)
        if 'stars' not in self.request.query_params:
            if 'is_dislike' in self.request.query_params:
                qs = qs.filter(is_dislike=get_param_bool(self.request.query_params['is_dislike']))
        else:
            stars = self.request.query_params.get('stars', False)
            if stars and stars.isdigit() and int(stars) >= 1 and int(stars) <= 5:
                qs = qs.filter(stars=stars)
        return sort_related(qs, self.request.user.pk)

    def get_object(self):
        ct = get_type(self)
        set_t(self)
        return get_object_or_404(Like, content_type=ct if ct else settings.CONTENT_TYPES['event'], object_id=self.kwargs['pk'], person=self.request.user)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if 'notype' in self.kwargs:
            context['notype'] = None
        if 'business' in self.kwargs:
            context['business'] = None
        elif 'stars' in self.kwargs:
            context['stars'] = None
        return context

    def create(self, request, *args, **kwargs):
        set_t(self)
        return super().create(request, *args, **kwargs)


class ReminderAPIView(generics.ListCreateAPIView, generics.DestroyAPIView):
    serializer_class = serializers.ReminderSerializer

    def __init__(self):
        super().__init__()
        self.permission_classes.append(permissions.IsOwnerOrReadOnly)

    def get_queryset(self):
        if self.request.method == 'GET':
            if self.kwargs['pk']:
                person = get_object(self.kwargs['pk'], User)
            else:
                person = self.request.user
            return Reminder.objects.filter(person=person)
        return Reminder.objects.filter(pk=self.kwargs['pk']) if self.kwargs['pk'] else Reminder.objects.none()