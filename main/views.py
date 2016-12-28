from django.shortcuts import render, redirect
from django.views.generic import TemplateView
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.utils import timezone
from django.db.models import Case, When, Value, IntegerField, F, Q, Max
# from django.conf.urls.static import static
# from django.shortcuts import get_object_or_404
# from django.db.models.functions import Coalesce
from django.views.decorators.csrf import csrf_protect
# from django.core.paginator import Paginator, InvalidPage
# from itertools import chain
from rest_framework.exceptions import NotFound #, MethodNotAllowed
from django.contrib.auth import get_user_model
from stronghold.decorators import public
from allauth.account import views
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.renderers import JSONRenderer
from rest_framework.filters import SearchFilter
from drf_multiple_model.views import MultipleModelAPIView
from drf_multiple_model.mixins import Query
from allauth.account.models import EmailAddress
from . import permissions, pagination, serializers
from rest_framework.serializers import ValidationError
from .models import Relationship, Notification, EventNotification, Business, Like, Comment, Item, Event, Recent, EVENT_MIN_CHAR, increment, get_content_types, get_content_types_pk, get_user_ct_pk, get_has_stars
from os import path
# from . import permissions
from . import forms
# from .decorators import login_forbidden
# from collections import OrderedDict
# from decorator_include import decorator_include
# from stronghold.views import StrongholdPublicMixin
from django.contrib.contenttypes.models import ContentType
from django.contrib.gis.measure import D
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import fromstr
from .serializers import NOT_MANAGER_MSG, gen_where, sort_related, friends_from

User = get_user_model()

@public
def home_index(request):
    if request.user.is_authenticated():
        return TemplateView.as_view(template_name='home.html')(request) # HomePageView.as_view()(request)
    return views.LoginView.as_view(template_name='index.html')(request) # IndexPageView.as_view()(request)

"""class HomePageView(TemplateView):
     template_name = "home.html"

class IndexPageView(LoginView):
     template_name = "index.html"""


@csrf_protect
def create_business(request):
    try:
        b = Business.objects.get(manager=request.user)
    except:
        pass
    else:
        return redirect('/'+b.shortname+'/')
    if request.method == 'POST':
        request.POST._mutable = True
        for s in [['t', 'sat'], ['t1', 'sun']]:
            if request.POST.get(s[0], False) != 'on':
                request.POST.pop('opened_'+s[1], None)
                request.POST.pop('closed_'+s[1], None)
        request.POST['manager'] = request.user.pk
        form = forms.BusinessForm(data=request.POST)
        if form.is_valid():
            Business.objects.create(**form.cleaned_data)
            return redirect('/'+form.cleaned_data['shortname']+'/')
    else:
        form = forms.BusinessForm()
    return render(request, 'create.html', {'form': form})


def increase_recent(request, obj):
    increment(Recent, {'user': request.user, 'content_type': ContentType.objects.get_for_model(obj), 'object_id': obj.pk})

def show_business(request, shortname):
    try:
        data = {'business': Business.objects.get_by_natural_key(shortname)}
    except Business.DoesNotExist:
        return redirect('/')
    if not data['business'].is_published and data['business'].manager != request.user:
        return redirect('/')
    if data['business'].likes.filter(person=request.user).exists():
        increase_recent(request, data['business'])
    data['fav_count'] = Like.objects.filter(content_type=get_content_types()['business'], object_id=data['business'].pk).count()
    if request.user != data['business'].manager:
        if Like.objects.filter(content_type=get_content_types()['business'], object_id=data['business'].pk, person=request.user).exists():
            data['fav_state'] = 1
        else:
            data['fav_state'] = 0
        data['minchar'] = serializers.REVIEW_MIN_CHAR
    else:
        data['fav_state'] = -1
        data['minchar'] = EVENT_MIN_CHAR
        data['form'] = forms.DummyCategory()
    return render(request, 'view.html', data)

def show_profile(request, username):
    try:
        data = {'user': User.objects.get_by_natural_key(username)}
    except User.DoesNotExist:
        return redirect('/')
    if friends_from(request.user).filter(pk=data['user'].pk).exists():
        increase_recent(request, data['user'])
    data['friend_count'] = friends_from(data['user']).count()
    if request.user != data['user']:
        data['rel_state'] = 0
        if Relationship.objects.filter(from_person=request.user, to_person=data['user']).exists():
            data['rel_state'] = 1
        if Relationship.objects.filter(from_person=data['user'], to_person=request.user).exists():
            data['rel_state'] += 2
    else:
        data['rel_state'] = -1
    return render(request, 'user.html', data)


def get_param_bool(param):
    return param and param in ['1', 'true', 'True', 'TRUE']

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
    if path.isfile(avatar+s+'jpg'):
        avatar += s+'jpg'
        mimeext = 'jpeg'
    elif path.isfile(avatar+s+'png'):
        avatar += s+'png'
    else:
        avatar = img_folder+'avatar'+s+'png'
        status = 404
    return HttpResponse(open(avatar, 'rb'), content_type='image/'+mimeext, status=status)

class BaseAuthView:
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


def get_loc(self, qs, f='business', loc=False, store=False):
    if 'pos' not in self.kwargs:
        try:
            pos = fromstr('POINT('+self.request.query_params['position'].replace(',', ' ')+')', srid=4326)
            pos.transform(3857)
        except:
            pos = self.request.user.loc_projected
        if store:
            self.kwargs['pos'] = pos
    else:
        pos = self.kwargs['pos']
    if f:
        f += '__'
    else:
        f = ''
    if loc:
        qs = qs.filter(**{f+'loc_projected__distance_lte': (pos, D(km=self.request.query_params.get('distance', 5)))})
    return qs.annotate(distance=Distance(f+'loc_projected', pos)).order_by('distance', *qs.model._meta.ordering) if loc is not None else qs

class SearchAPIView(generics.ListAPIView):
    filter_backends = (SearchFilter,)

    def paginate_queryset(self, queryset):
        if self.request.query_params.get('search', False):
            self.pagination_class = pagination.SearchPagination
        return super().paginate_queryset(queryset)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.request.query_params.get('search', False) and not self.request.query_params.get('limit', '').isdigit():
            context['list'] = None
        return context

class BusinessAPIView(SearchAPIView):
    serializer_class = serializers.BusinessSerializer
    search_fields = ('name', 'shortname')

    def get_queryset(self):
        ins = not isinstance(self, BusinessAPIView)
        return get_loc(self, Business.objects.filter(is_published=True).defer('manager', 'phone', 'address', 'is_published'), None, ins, ins)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['home'] = None
        return context

def get_object(pk, cl=User):
    """
    @type cl: django.db.models.Model
    """
    try:
        return cl.objects.get(pk=pk)
    except:
        raise NotFound(cl.__name__+" not found.") #Response(status=status.HTTP_400_BAD_REQUEST)

class UserAPIView(SearchAPIView, generics.CreateAPIView, generics.DestroyAPIView):
    filter_backends = (SearchFilter,)
    search_fields = ('first_name', 'last_name', 'username')

    def get_serializer_class(self):
        if self.request.method != 'GET':
            return serializers.RelationshipSerializer
        return serializers.UserSerializer

    def get_queryset(self):
        if self.request.query_params.get('search', False):
            return User.objects.exclude(pk=self.request.user.pk).order_by(Case(When(location=self.request.user.location, then=Value(0)), output_field=IntegerField()), *User._meta.ordering)
        person = get_object(self.kwargs['pk']) if self.kwargs['pk'] else self.request.user
        qs = friends_from(person, True)
        if person != self.request.user:
            return sort_related(qs, self.request.user)
        return sort_related(qs, where=gen_where('user', self.request.user.pk, 'recent', 'user', ct=get_user_ct_pk()))

    def delete(self, request, *args, **kwargs):
        person = get_object(self.kwargs['pk']) if self.kwargs['pk'] else self.request.user
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
        if self.request.query_params.get('page', False):
            return super().paginate_queryset(queryset)
        return None

    def create_notif(self, txt, pks, created):
        self.request.user.notification_set.add(Notification(text=txt[0], link='#/show='+','.join(str(v) for v in pks)+'&type='+txt[1], created=created), bulk=False)

    def gen_person(self, person):
        return '<a href="/user/%s/"><i>%s %s</i></a>' % (person.username, person.first_name, person.last_name)

    def add_notif(self, curr, created):
        if curr['typ'] is not None:
            txt = [(self.gen_person(curr['persons'][0])+" has" if len(curr['persons']) == 1 else str(len(curr['persons']))+" persons have")+' '+("commented on" if curr['typ'] != 2 else "reviewed")+' '+(("your" if curr['typ'] != 1 else "a")+' '+(curr['ct'].model_class()._meta.verbose_name.lower() if curr['typ'] != 2 else "business") if len(curr['pks']) == 1 else str(len(curr['pks']))+' '+curr['ct'].model_class()._meta.verbose_name_plural.lower())+(" on your business" if curr['typ'] == 1 else '')+'.', (curr['ct'].model if curr['ct'] != get_content_types()['comment'] else 'review')+('&showcomments' if curr['typ'] != 2 and len(curr['pks']) == 1 else '')]
        else:
            txt = [self.gen_person(curr['persons'][0])+" notifies you about "+("one event" if len(curr['pks']) == 1 else str(len(curr['pks']))+" events"), 'event']
        self.create_notif(txt, curr['pks'], created)

    def get_queryset(self):
        if self.request.query_params.get('page', False):
            return self.request.user.notification_set.filter(unread=False)
        else:
            notifies = EventNotification.objects.filter(to_person=self.request.user)
            if notifies.count() > 0:
                rems = notifies.filter(from_person=None, when__lte=timezone.now())
                if rems.count() > 0:
                    curr = []
                    for i in range(rems.count()):
                        if rems[i].object_id not in curr:
                            curr.append(rems[i].object_id)
                    self.create_notif(["You have "+("one reminder" if len(curr) == 1 else str(len(curr))+" reminders")+'.', 'event'], curr, rems.last().when)
                    rems._raw_delete(rems.db)
                notifies = notifies.exclude(from_person=None)
                if notifies.count() > 0:
                    curr = {'pks': [], 'persons': [notifies.first().from_person], 'typ': notifies.first().comment_type, 'ct': notifies.first().content_type}
                    for notif in notifies:
                        if curr['typ'] != notif.comment_type or curr['ct'] != notif.content_type:
                            self.add_notif(curr, notif.when)
                            curr['pks'][:] = [notif.object_id]
                            curr['persons'][:] = [notif.from_person]
                            if curr['typ'] != notif.comment_type:
                                curr['typ'] = notif.comment_type
                            else:
                                curr['ct'] = notif.content_type
                        if notif.object_id not in curr['pks']:
                            curr['pks'].append(notif.object_id)
                        if notif.from_person != curr['persons'][-1]:
                            curr['persons'].append(notif.from_person)
                    # noinspection PyUnboundLocalVariable
                    self.add_notif(curr, notif.when)
                    notifies._raw_delete(notifies.db)

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
                if request.user != person and not EventNotification.objects.filter(from_person=request.user, to_person=person, content_type=get_content_types()['event'], object_id=event.pk).exists():
                    EventNotification.objects.create(from_person=request.user, to_person=person, content_type=get_content_types()['event'], object_id=event.pk)
                    if not notxt:
                        # noinspection PyUnboundLocalVariable
                        cnt += 1
            status = 200
            # noinspection PyUnboundLocalVariable
            text = str(cnt)+" persons have been notified." if not notxt else None
        return status, text
    return base_view(request, t, cont, pk=pk)


def filter_published(model, ct_f='business'):
    if isinstance(ct_f, int):
        return model.objects.filter(content_type__pk=ct_f).extra(where=[gen_where(model.__name__.lower(), 1, column='is_published', target='business', ct=ct_f)])
    return model.objects.filter(**{(ct_f+'__' if ct_f else '')+'is_published': True})

class FeedAPIView(MultipleModelAPIView):
    sorting_field = '-sort_field'
    flat = True
    max = 20

    def get_queryList(self):
        def get_friends_qs(model, filter='business__manager', ct=None):
            """
            @type model: django.db.models.Model
            """
            if not ct:
                f = None if filter is None else 'business'
            qs = filter_published(model, ct or f)
            if filter:
                qs = qs.filter(Q(**{filter + '__in': friends}) | Q(likes__person__in=friends)).annotate(is_liked=Max(Case(When(likes__person__in=friends, then=1), default=0, output_field=IntegerField())), sort_field=Max(Case(When(likes__person__in=friends, then=F('likes__date')), default=F('created')))) #.distinct('pk')
            else:
                qs = qs.filter(likes__person__in=friends).annotate(sort_field=F('likes__date'))
            return (get_loc(self, qs, f, store=True) if not ct else qs)[:self.max]

        friends = list(friends_from(self.request.user).values_list('pk', flat=True))
        return [(get_friends_qs(Business, None), serializers.BusinessSerializer),
                (get_friends_qs(Event), serializers.EventSerializer),
                (get_friends_qs(Item), serializers.ItemSerializer),
                (get_friends_qs(Comment, 'person', get_content_types()['business'].pk), serializers.CommentSerializer),
                (Relationship.objects.filter(Q(from_person__in=friends) | Q(to_person__in=friends)).filter(symmetric=True).exclude(to_person=self.request.user).exclude(from_person=self.request.user).annotate(rev_dir=Case(When(to_person__in=friends, then=1), default=0, output_field=IntegerField()), sort_field=F('notification__created')).defer('notification', 'symmetric')[:self.max], serializers.RelationshipSerializer, 'user')]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['feed'] = None
        return context

class BaseAPIView(generics.ListCreateAPIView, generics.DestroyAPIView):
    pagination_class = pagination.EventPagination
    filter = 'business__manager'
    order_by = 'created'
    ct = None

    def __init__(self):
        super().__init__()
        self.permission_classes.append(permissions.IsOwnerOrReadOnly)
        self.main_f = self.ct or 'business'

    def get_person_qs(self, person):
        qs = filter_published(self.model, self.main_f).filter(Q(**{self.filter: person}) | Q(likes__person=person))
        return qs.order_by(Case(When(likes__person=person, then=F('likes__date')), default=F(self.order_by)).desc(), *self.model._meta.ordering) if self.order_by else qs

    def get_qs_pk(self):
        business = get_object(self.kwargs['pk'], Business)
        return self.model.objects.filter(business=business)

    def order_qs(self, qs):
        return qs

    def getnopk(self):
        return filter_published(self.model, self.main_f)

    def get_queryset(self):
        if self.request.query_params.get('ids', False):
            return self.model.objects.filter(pk__in=[n for n in self.request.query_params['ids'].split(',') if n.isdigit()])
        if get_param_bool(self.request.query_params.get('is_person', False)):
            if self.kwargs['pk']:
                person = get_object(self.kwargs['pk'], User)
                #if person != self.request.user:
                self.kwargs['person'] = person
            else:
                person = self.request.user
            return self.get_person_qs(person)
        if self.request.method == 'GET' and self.kwargs['pk']:
            return self.order_qs(self.get_qs_pk())
            #self.kwargs['person_business'] = True
        elif self.request.method == 'GET':
            return self.getnopk()
        elif self.kwargs['pk']:
            return self.model.objects.filter(pk=self.kwargs['pk'])
        return self.model.objects.none()

    def paginate_queryset(self, queryset):
        if not self.request.query_params.get('ids', False):
            if self.filter_backends and self.request.query_params.get('search', False):
                self.pagination_class = pagination.SearchPagination
            return super().paginate_queryset(queryset)
        return None

    def get_serializer_context(self):
        context = super().get_serializer_context()
        for f in ['home', 'search']:
            if f in self.kwargs:
                context[f] = None
        if 'person' in self.kwargs:
            context['person'] = self.kwargs['person']
        if self.request.query_params.get('no_business', False):
            context['hiddenbusiness'] = None
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
            return pk if dic != get_has_stars() else True
        return False if dic != get_has_stars() else int(pk)
    return None

def get_type(obj):
    """
    @type obj: django.views.generic.base.View
    """
    if 'ct' not in obj.kwargs:
        pk = get_t_pk(obj, get_content_types_pk())
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
    return model.objects.filter(content_type=ct if ct else get_content_types()['event'], object_id=obj.pk)

def set_t(obj_v, context):
    """
    @type obj_v: django.views.generic.base.View
    """
    pk = get_t_pk(obj_v, get_has_stars())
    if pk is True:
        context['stars'] = None
    elif pk == get_content_types()['business'].pk:
        context['business'] = None
    else:
        return False
    return True

class CommentAPIView(BaseAPIView):
    serializer_class = serializers.CommentSerializer
    model = Comment
    filter = 'person'
    ct = get_content_types()['business'].pk

    def getnopk(self):
        return self.order_qs(self.get_person_qs(self.request.user))

    def get_person_qs(self, person):
        return super().get_person_qs(person).annotate(is_liked=Case(When(likes__person=person, then=1), default=0, output_field=IntegerField()))

    def get_qs_pk(self):
        return get_qs(self, Comment)

    def order_qs(self, qs):
        if not self.request.query_params.get('ids', False):
            if 'business' in self.get_serializer_context(True):
                qs = qs.order_by(Case(When(person=self.request.user, then=Value(0)), output_field=IntegerField()).desc(), *Comment._meta.ordering)
            else:
                self.pagination_class = pagination.CommentPagination
                if get_param_bool(self.request.query_params.get('reverse', False)):
                    qs = qs.order_by('created')
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
        #if not kw:
        return context

    def delete(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.status is not None and obj.content_object.main_comment == obj:
            co = obj.content_object
            obj.delete()
            co.main_comment = Comment.objects.filter(content_type=get_content_types()['comment'], object_id=co.pk, status__isnull=False).last()
            if co.main_comment:
                co.save()
                return Response(data=serializers.CommentSerializer(co.main_comment, context=self.get_serializer_context()).data)
        else:
            obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class EventAPIView(BaseAPIView):
    serializer_class = serializers.EventSerializer
    model = Event
    filter_backends = (SearchFilter,)
    search_fields = ('text',) #'business__name'

    def getnopk(self):
        if not isinstance(self, EventAPIView):
            self.model = Event
            self.main_f = 'business'
            qs = BaseAPIView.getnopk(self)
        else:
            qs = super().getnopk()
            self.kwargs['search'] = None
        if get_param_bool(self.request.query_params.get('favourites', False)):
            return get_loc(self, qs.extra(where=[gen_where('event', self.request.user.pk, 'like', 'person', 'business', ct=get_content_types()['business'].pk)]))
        return get_loc(self, qs, loc=not self.request.query_params.get('search', False)) #, store=not isinstance(self, EventAPIView)

def get_b_from(user):
    try:
        return Business.objects.get(manager=user)
    except:
        raise NotFound(NOT_MANAGER_MSG)

class ItemAPIView(BaseAPIView):
    serializer_class = serializers.ItemSerializer
    model = Item
    filter_backends = (SearchFilter,)
    search_fields = ('name',)

    def getnopk(self):
        qs = super().getnopk()
        if self.request.query_params.get('search', False):
            self.kwargs['search'] = None
            return get_loc(self, qs)
        return qs.filter(business=get_b_from(self.request.user))

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
        if not get_param_bool(self.request.query_params.get('is_person', False)) and get_param_bool(self.request.query_params.get('menu', False)):
            context['hiddenbusiness'] = None
            context['menu'] = None
        if self.request.query_params.get('ids', False):
            context['ids'] = None
        return context

    def delete(self, request, *args, **kwargs):
        obj = self.get_object()
        if Item.objects.filter(business=obj.business).count() == 1:
            raise ValidationError({'non_field_errors': ["The last remaining item can't be deleted."]})
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MultiBaseAPIView(MultipleModelAPIView):
    def prep_chk(self, page_size=None):
        self.kwargs['page_size'] = page_size or self.pagination_class.page_size
        self.request.query_params._mutable = True
        def chk(queryset, request, *args, **kwargs):
            if queryset.count() >= self.kwargs['page_size']:
                request.query_params[None] = queryset.count() == self.kwargs['page_size'] + 1
            return queryset[:self.kwargs['page_size']]
        self.kwargs['chk_fn'] = chk

    def gen_qli(self, qs, ser, page_size=None):
        if page_size:
            self.prep_chk(page_size)
        return Query(qs[:self.kwargs['page_size'] + 1], ser, filter_fn=self.kwargs['chk_fn'])

    def format_data(self, new_data, query, results):
        if self.flat:
            return super().format_data(new_data, query, results)
        new_data = {'results': new_data}
        hm = self.request.query_params.pop(None, None)
        if hm is not None:
            new_data['has_more'] = hm
        results.append(new_data)
        return results

class HomeAPIView(MultiBaseAPIView):
    def get_queryList(self):
        return [(BusinessAPIView.get_queryset(self), serializers.BusinessSerializer), self.gen_qli(EventAPIView.getnopk(self), serializers.EventSerializer, pagination.EventPagination.page_size)]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['home'] = None
        return context

class LikeAPIView(MultiBaseAPIView, generics.CreateAPIView, generics.UpdateAPIView, generics.DestroyAPIView):
    serializer_class = serializers.LikeSerializer
    flat = True
    add_model_type = False

    def __init__(self):
        super().__init__()
        self.permission_classes.append(permissions.IsOwnerOrReadOnly)

    def gen_qs(self, qs, filter, range):
        self.flat = False
        self.prep_chk()
        ret = []
        for v in range:
            ret.append(self.gen_qli(sort_related(qs.filter(**{filter: v}), self.request.user), serializers.LikeSerializer))
        return ret

    def format_data(self, new_data, query, results):
        if self.flat:
            return super().format_data(new_data, query, results)
        new_data = {'results': new_data}
        hm = self.request.query_params.pop(None, None)
        if hm is not None:
            new_data['has_more'] = hm
        results.append(new_data)
        return results

    def get_queryList(self):
        if not self.kwargs['pk'] or get_type(self) and self.kwargs['ct'] == get_content_types()['business']:
            pk = self.kwargs['pk']
            is_user = get_param_bool(self.request.query_params.get('is_person', False))
            if is_user:
                if get_type(self) and self.kwargs['ct'] == get_content_types()['business']:
                    self.kwargs['notype'] = None
                if pk and pk != self.request.user.pk:
                    person = get_object(pk)
                    return [(sort_related(Business.objects.filter(likes__person=person), Business.objects.filter(manager=self.request.user).first(), gen_where('business', self.request.user.pk, 'like', 'person', ct=get_content_types()['business'].pk)), serializers.BusinessSerializer)]
                return [(sort_related(Business.objects.filter(likes__person=self.request.user), where=gen_where('business', self.request.user.pk, 'recent', 'user', ct=get_content_types()['business'].pk)), serializers.BusinessSerializer)]
            business = get_object(pk, Business) if pk else get_b_from(self.request.user)
            return [(sort_related(User.objects.filter(like__content_type=get_content_types()['business'], like__object_id=business.pk), self.request.user, gen_where('user', business.pk, 'like', 'object', ct=get_content_types()['business'].pk)), serializers.UserSerializer)]
        qs = get_qs(self, Like)
        if 'stars' not in self.get_serializer_context(True):
            if get_param_bool(self.request.query_params.get('init', False)):
                return self.gen_qs(qs, 'is_dislike', [False, True])
            if self.request.query_params.get('is_dislike', False):
                qs = qs.filter(is_dislike=get_param_bool(self.request.query_params['is_dislike']))
            else:
                self.kwargs['context']['showtype'] = None
        else:
            if get_param_bool(self.request.query_params.get('init', False)):
                return self.gen_qs(qs, 'stars', range(1, 6))
            stars = self.request.query_params.get('stars', False)
            if stars and stars.isdigit() and 1 <= int(stars) <= 5:
                qs = qs.filter(stars=stars)
            else:
                self.kwargs['context']['showtype'] = None
        return [(sort_related(qs, self.request.user), serializers.LikeSerializer)]

    def get_object(self):
        ct = get_type(self)
        return get_object_or_404(Like, content_type=ct if ct else get_content_types()['event'], object_id=self.kwargs['pk'], person=self.request.user)

    def get_serializer_context(self, kw=False):
        if 'context' not in self.kwargs:
            context = super().get_serializer_context()
            set_t(self, context)
            if get_param_bool(self.request.query_params.get('show_date', False)):
                context['showdate'] = None
            if 'notype' in self.kwargs:
                context['notype'] = None
            if kw:
                self.kwargs['context'] = context
        else:
            context = self.kwargs['context']
        return context

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
            return EventNotification.objects.filter(to_person=person, type=None)
        return EventNotification.objects.filter(pk=self.kwargs['pk']) if self.kwargs['pk'] else EventNotification.objects.none()