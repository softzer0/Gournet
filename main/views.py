from django.shortcuts import render, redirect
from django.views.generic import TemplateView as DefTemplateView, FormView
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.utils import timezone
from django.db.models import Case, When, IntegerField, F, Q, Max, Avg, Count
# from django.conf.urls.static import static
# from django.shortcuts import get_object_or_404
# from django.db.models.functions import Coalesce
# from django.core.paginator import Paginator, InvalidPage
# from itertools import chain
from rest_framework.exceptions import NotFound #, MethodNotAllowed
from django.contrib.auth import get_user_model
from stronghold.decorators import public
from stronghold.views import StrongholdPublicMixin
from allauth.account.views import LoginView
from rest_framework.views import APIView
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.filters import SearchFilter
from rest_framework.pagination import Cursor
from allauth.account.models import EmailAddress
from drf_multiple_model.views import MultipleModelAPIView
from drf_multiple_model.mixins import Query
from . import permissions, pagination, serializers, forms, models
from os import path
# from . import permissions
# from .decorators import login_forbidden
# from collections import OrderedDict
# from decorator_include import decorator_include
# from stronghold.views import StrongholdPublicMixin
from django.contrib.contenttypes.models import ContentType
from django.contrib.gis.measure import D
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import fromstr
from django.utils.formats import time_format
from pytz import common_timezones
from json import dumps
from PIL import Image
from .thumbs import saveimgwiththumbs
from django.utils.translation import ungettext, ugettext as _, pgettext, npgettext
from django.core.cache.utils import make_template_fragment_key
from django.core.cache import cache
from django.core.urlresolvers import reverse
from .context_processor import recent as gen_recent_context, gen_qs as gen_recent_qs
from rest_framework_simplejwt.views import TokenViewBase
from rest_framework.parsers import FileUploadParser
from .decorators import table_session_check

User = get_user_model()

class TokenObtainPairView(TokenViewBase):
    serializer_class = serializers.TokenObtainPairSerializer

class TokenRefreshView(TokenViewBase):
    serializer_class = serializers.TokenRefreshSerializer

def render_with_recent(request, template, context={}):
    context.update(gen_recent_context(request))
    return render(request, template, context)

class TemplateView(DefTemplateView):
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        if self.request.user.is_authenticated:
            context.update(gen_recent_context(self.request))
        return context

def basenohf(request, **kwargs):
    response = kwargs[''](request)
    if request.GET.get('nohf'):
        response.set_cookie('nohf', None)
    return response

@public
def home_index(request):
    if request.user.is_authenticated:
        return TemplateView.as_view(template_name='home.html')(request) # HomePageView.as_view()(request)
    return LoginView.as_view(template_name='index.html')(request) # IndexPageView.as_view()(request)

class InfoView(StrongholdPublicMixin, TemplateView):
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['file'] = 'home' if self.request.user.is_authenticated else 'main'
        return context

def edit_view(request):
    return render(request, 'create_extra.html', {'form': forms.BaseForm(), 'f': ['data.form[0]', ' || data.disabled', ' ng-disabled="data.disabled"']})


def get_param_bool(param):
    return param and param in ('1', 'true', 'True', 'TRUE')

@table_session_check()
def i18n_view(request):
    st = None
    if request.method == 'POST':
        c = []
        for f in ('tz', 'language', 'currency'):
            if f in request.POST and f == 'tz' and request.user.tz.zone != request.POST[f] or f != 'tz' and getattr(request.user, f) != request.POST[f]:
                setattr(request.user, f, request.POST[f])
                c.append(f)
        if c:
            try:
                request.user.save()
            except:
                st = status.HTTP_400_BAD_REQUEST
        #if get_param_bool(request.GET.get('nohtml', False)):
        return HttpResponse(dumps({'altered': c}), status=st)
    return render(request, 'i18n.html', {'timezones': common_timezones, 'langs': settings.LANGUAGES, 'currencies': models.CURRENCY} if not cache.get(make_template_fragment_key('i18n')) else None, status=st)


def get_b_from(user):
    try:
        return models.Business.objects.get(manager=user)
    except:
        raise NotFound(serializers.NOT_MANAGER_MSG)

def gen_resp(msg):
    return {'detail': msg}

@table_session_check()
class ImageAPIView(APIView):
    def get(self, request, type, pk=None, size=None):
        img_folder = path.join(settings.MEDIA_ROOT, 'images')+'/'+type+'/'
        if not pk and type == 'item':
            return Response(gen_resp("Missing ID parameter for item."), status=status.HTTP_400_BAD_REQUEST)
        avatar = img_folder+(pk or str(request.user.pk if type == 'user' else get_b_from(request.user).pk))+'/avatar'
        s = '.'
        st = None
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
            st = status.HTTP_404_NOT_FOUND
        return HttpResponse(open(avatar, 'rb'), content_type='image/'+mimeext, status=st)


class UploadAPIView(APIView):
    parser_classes = (FileUploadParser,)

    def put(self, request, pk_b=None):
        if 'file' not in request.data:
            return Response(gen_resp("Image is missing."), status=status.HTTP_400_BAD_REQUEST)
        if pk_b:
            if pk_b == 'business':
                try:
                    business = models.Business.objects.get(manager=request.user)
                except:
                    return Response(gen_resp(serializers.NOT_MANAGER_MSG), status=status.HTTP_400_BAD_REQUEST)
                t = pk_b
            else:
                try:
                    pk_b = models.Item.objects.get(pk=pk_b, business__manager=request.user)
                except:
                    return Response(gen_resp("Item isn't found, or it's not yours."), status=status.HTTP_400_BAD_REQUEST)
                t = 'item'
        else:
            t = 'user'
        try:
            image = Image.open(request.data['file'])
            if image.format not in ('JPEG', 'PNG', 'GIF'):
                return Response(gen_resp(_("Image format not supproted.")), status=status.HTTP_403_FORBIDDEN)
            image.verify()
        except:
            return Response(gen_resp(_("Invalid image.")), status=status.HTTP_400_BAD_REQUEST)
        saveimgwiththumbs(t, business.pk if pk_b == 'business' else pk_b.pk if pk_b else request.user.pk, image.format, Image.open(request.data['file']))
        if pk_b and pk_b != 'business' and not pk_b.has_image:
            pk_b.has_image = True
            pk_b.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ContactView(StrongholdPublicMixin, FormView, TemplateView):
    template_name = 'contact.html'
    form_class = forms.ContactForm

    def form_valid(self, form):
        models.User.objects.get(username='mikisoft').email_user(form.cleaned_data['email'], form.cleaned_data['message'])
        self.template_name = 'contact_sent.html'
        return self.render_to_response(self.get_context_data())

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update({'file': 'home' if self.request.user.is_authenticated else 'main'})
        return context

def create_business(request):
    try:
        b = models.Business.objects.get(manager=request.user)
    except:
        pass
    else:
        return redirect('/'+b.shortname+'/')
    if request.method == 'POST':
        request.POST._mutable = True
        for s in (('t', 'sat'), ('t1', 'sun')):
            if request.POST.get(s[0], False) != 'on':
                request.POST.pop('opened_'+s[1], None)
                request.POST.pop('closed_'+s[1], None)
        form = forms.BusinessForm(data=request.POST)
        if form.is_valid():
            form.cleaned_data['manager'] = request.user
            models.Business.objects.create(**form.cleaned_data)
            request.user.is_manager = True
            request.user.save()
            return redirect('/'+form.cleaned_data['shortname']+'/')
    else:
        form = forms.BusinessForm()
    return render_with_recent(request, 'create.html', {'form': form, 'f': ['date', '', '']})


def increase_recent(request, obj):
    models.increment(models.Recent, {'user': request.user, 'content_type': ContentType.objects.get_for_model(obj), 'object_id': obj.pk})

WORKH = ['{{ data.value[0]['+str(i)+'] }}' for i in range(0, 6)]
@table_session_check()
def show_business(request, shortname):
    try:
        data = {'business': models.Business.objects.get_by_natural_key(shortname)}
    except models.Business.DoesNotExist:
        return redirect('/')
    if not data['business'].is_published and data['business'].manager != request.user and not request.user.is_staff:
        return redirect('/')
    data['fav_count'] = data['business'].likes.count()
    data['rating'] = models.Review.objects.filter(object_id=data['business'].pk).aggregate(Count('stars'), Avg('stars'))
    data['rating'] = [data['rating']['stars__avg'] or 0, data['rating']['stars__count'] or 0]
    def popl():
        data['workh'] = {'value': []}
        for f in ('', '_sat', '_sun'):
            if getattr(data['business'], 'opened'+f) is not None:
                data['workh']['value'].append(time_format(getattr(data['business'], 'opened'+f), 'H:i'))
                data['workh']['value'].append(time_format(getattr(data['business'], 'closed'+f), 'H:i'))
    if request.user != data['business'].manager:
        if request.user.is_authenticated and data['business'].likes.filter(person=request.user).exists():
            increase_recent(request, data['business'])
            data['fav_state'] = 1
        else:
            data['fav_state'] = 0
        data['minchar'] = serializers.REVIEW_MIN_CHAR
        try:
            data['rating'].append(models.Review.objects.get(object_id=data['business'].pk, person=request.user).stars)
        except:
            data['rating'].append(0)
        if data['business'].opened != data['business'].closed or not data['business'].opened_sat or data['business'].opened_sat != data['business'].closed_sat or not data['business'].opened_sun or data['business'].opened_sun != data['business'].closed_sun:
            popl()
            data['workh']['display'] = data['workh']['value']
    else:
        data['fav_state'] = -1
        if not cache.get(make_template_fragment_key('edit_data')):
            data['edit_data'] = {'types': models.BUSINESS_TYPE, 'forbidden': models.FORBIDDEN}
            data['curr'] = models.CURRENCY
            data['form'] = forms.DummyCategory()
        popl()
        data['workh']['display'] = WORKH
    data['minchar'] = models.EVENT_MIN_CHAR
    return render_with_recent(request, 'view.html', data)

def show_profile(request, username):
    try:
        data = {'usr': User.objects.get_by_natural_key(username)}
    except User.DoesNotExist:
        return redirect('/')
    if serializers.friends_from(request.user).filter(pk=data['usr'].pk).exists():
        increase_recent(request, data['usr'])
    data['friend_count'] = serializers.friends_from(data['usr']).count()
    data['rel_state'] = serializers.get_rel_state(request, data['usr'])
    if request.user != data['usr'] or request.user.birthdate_changed:
        data['born'] = serializers.UserSerializer.get_born_ago(None, data['usr'])
    return render_with_recent(request, 'user.html', data)


class EmailAPIView(generics.ListCreateAPIView, generics.UpdateAPIView):
    serializer_class = serializers.EmailSerializer
    pagination_class = None
    lookup_field = 'email'

    def get_queryset(self):
        return EmailAddress.objects.filter(user=self.request.user).order_by('-primary', '-verified')

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=kwargs.pop('partial', False))
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}
        return Response(serializer.data) if serializer.data['email'] else Response(status=status.HTTP_204_NO_CONTENT)


class SearchAPIView(generics.ListAPIView, generics.RetrieveUpdateAPIView):
    search_pag_class = pagination.SearchPagination
    filter_backends = (SearchFilter,)

    def if_info(self):
        return not self.request.query_params.get('search', False)

    def list(self, request, *args, **kwargs):
        if self.if_info():
            return self.retrieve(request, *args, **kwargs)
        return super().list(request, *args, **kwargs)

    def paginate_queryset(self, queryset):
        if self.request.query_params.get('search', False):
            self.pagination_class = self.search_pag_class
        return super().paginate_queryset(queryset)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.request.query_params.get('search', False) and not self.request.query_params.get('limit', '').isdigit():
            context['list'] = None
        if self.if_info():
            context['single'] = None
        return context

class IsOwnerOrReadOnly(APIView):
    def __init__(self):
        super().__init__()
        self.permission_classes.append(permissions.IsOwnerOrReadOnly)

class FakePag:
    display_page_controls = False

    def get_results(self, _):
        pass

def get_object(pk, cl=User):
    """
    @type cl: django.db.models.Model
    """
    try:
        return cl.objects.get(pk=pk)
    except:
        raise NotFound(cl._meta.model_name.capitalize()+" not found.") #Response(status=status.HTTP_400_BAD_REQUEST)

class BusinessAPIView(IsOwnerOrReadOnly, SearchAPIView, generics.CreateAPIView):
    serializer_class = serializers.BusinessSerializer
    search_fields = ('name', 'shortname')
    max = 5

    def get_object(self):
        return get_object(self.kwargs['pk'], models.Business) if self.kwargs['pk'] else get_b_from(self.request.user)

    def paginate_queryset(self, queryset):
        if not get_param_bool(self.request.query_params.get('quick', False)):
            return super().paginate_queryset(queryset)
        self.pagination_class = FakePag
        return queryset

    def get_queryset(self):
        qs = not isinstance(self, BusinessAPIView)
        qs = get_loc(self, filter_published(self, model=models.Business), False, qs, qs, False) #.order_by(Case(When(Q(currency=self.request.user.currency) | Q(supported_curr__contains=self.request.user.currency), then=Value(0)), output_field=IntegerField()), *models.Business._meta.ordering)
        return qs.only('id', 'shortname', 'name') if get_param_bool(self.request.query_params.get('quick', False)) else qs.defer('manager', 'phone', 'address', 'is_published')

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)
        if get_param_bool(self.request.query_params.get('quick', False)):
            self.kwargs['more'] = queryset.count() > self.max
            queryset = queryset[:self.max]
        return queryset

    def get_serializer_context(self):
        if get_param_bool(self.request.query_params.get('quick', False)):
            return {}
        context = super().get_serializer_context()
        context['home'] = None
        return context

    def get_paginated_response(self, data):
        r = {'results': data}
        if 'more' in self.kwargs:
            r['has_more'] = self.kwargs['more']
        return Response(r)


class UserAPIView(SearchAPIView, generics.CreateAPIView):
    search_pag_class = pagination.UserPagination
    pagination_class = pagination.FriendsPagination
    filter_backends = (SearchFilter,)
    search_fields = ('first_name', 'last_name', 'username')

    def if_info(self):
        return get_param_bool(self.request.query_params.get('info', False)) or self.request.method != 'GET'

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return serializers.RelationshipSerializer
        return serializers.UserSerializer

    def get_object(self):
        return get_object(self.kwargs['pk']) if self.kwargs['pk'] and int(self.kwargs['pk']) != self.request.user.pk else self.request.user

    def get_queryset(self):
        if self.request.query_params.get('search', False):
            return User.objects.exclude(pk=self.request.user.pk).order_by(Distance('loc_projected', self.request.user.loc_projected), *User._meta.ordering)
        person = self.get_object()
        """qs = serializers.friends_from(person, True)
        if person != self.request.user:
            return serializers.sort_related(qs, self.request.user)"""
        return serializers.friends_from(person, True) #serializers.sort_related(qs, where=serializers.gen_where('user', self.request.user.pk, 'recent', 'user', ct=ContentType.objects.get(model='user').pk))"""

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if 'single' in context and (not self.kwargs['pk'] or int(self.kwargs['pk']) == self.request.user.pk):
            context['owner'] = None
        return context

    def delete(self, request, *args, **kwargs):
        person = get_object(self.kwargs['pk'])
        try:
            models.Relationship.objects.get(from_person=request.user, to_person=person).delete()
        except:
            raise NotFound("Relationship not found.")
        try:
            rel = models.Relationship.objects.get(from_person=person, to_person=request.user)
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
        self.request.user.notification_set.add(models.Notification(text=txt[0], link='#/show='+','.join(str(v) for v in pks)+'&type='+txt[1], created=created), bulk=False)

    def add_notif(self, curr, created):
        txt = {}
        if len(curr['persons']) == 1:
            txt['name'] = '<a href="'+reverse('user_profile', kwargs={'username': curr['persons'][0].username})+'"><i>'+curr['persons'][0].first_name+' '+curr['persons'][0].last_name+'</i></a>'
        if curr['typ'] is None or curr['typ'] == 1 and len(curr['pks']) > 1:
            txt['count'] = len(curr['pks'])
        if curr['typ'] is not None:
            if curr['typ'] != 2:
                txt['person_action'] = _("%s has commented on") % txt['name'] if len(curr['persons']) == 1 else ungettext("%d have commented on", "%d have commented on", len(curr['persons'])) % len(curr['persons'])
                if curr['typ'] == 1:
                    if len(curr['pks']) == 1:
                        txt = pgettext('person has commented on', "%s a review on your business.") % txt['person_action']
                    else:
                        txt = ungettext("%(person_action)s %(count)d review on your business.", "%(person_action)s %(count)d reviews on your business.", txt['count']) % txt
                else:
                    txt = txt['person_action']+' '+(npgettext('commented on', "your %d "+(curr['ct'].model_class()._meta.verbose_name._proxy____args[0] if curr['ct'].model != 'comment' else "review"), "your %d "+(curr['ct'].model_class()._meta.verbose_name_plural._proxy____args[0] if curr['ct'].model != 'comment' else "reviews"), len(curr['pks'])) % len(curr['pks']))+"."
            else:
                txt = _("%s has reviewed your business.") % txt['name'] if len(curr['persons']) == 1 else ungettext("%d have reviewed your business.", "%d have reviewed your business.", len(curr['persons'])) % len(curr['persons'])
        else:
            txt = ungettext("%(name)s notifies you about %(count)d event.", "%(name)s notifies you about %(count)d events.", txt['count']) % txt
        self.create_notif([txt, ((curr['ct'].model if curr['ct'].model != 'comment' else 'review')+('&showcomments' if len(curr['pks']) == 1 else '')) if curr['typ'] is not None else 'event'], curr['pks'], created)

    def get_queryset(self):
        if self.request.query_params.get('page', False):
            return self.request.user.notification_set.filter(unread=False)
        notifies = models.EventNotification.objects.filter(to_person=self.request.user)
        if notifies.count() > 0:
            rems = notifies.filter(from_person=None, when__lte=timezone.now())
            if rems.count() > 0:
                curr = []
                for i in range(rems.count()):
                    if rems[i].object_id not in curr:
                        curr.append(rems[i].object_id)
                self.create_notif([ungettext("You have %d reminder.", "You have %d reminders.", len(curr)) % len(curr), 'event'], curr, rems.last().when)
                rems._raw_delete(rems.db)
            notifies = notifies.exclude(from_person=None)
            if notifies.count() > 0:
                curr = {'pks': [], 'persons': [notifies.first().from_person], 'typ': notifies.first().comment_type, 'ct': notifies.first().content_type}
                for notif in notifies:
                    if curr['typ'] != notif.comment_type or curr['ct'] != notif.content_type:
                        self.add_notif(curr, notif.when)
                        curr['pks'][:] = [notif.object_id]
                        curr['persons'][:] = [notif.from_person]
                        curr['typ'] = notif.comment_type
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


class BaseNotifAPIView(APIView):
    def get(self, *args, **kwargs):
        try:
            objpks = self.t()
        except:
            st = status.HTTP_400_BAD_REQUEST
            text = "Invalid parameter provided."
        else:
            st, text = self.cont(objpks, **kwargs)
        return Response(gen_resp(text), status=st)

class SetNotifsReadAPIView(BaseNotifAPIView):
    def t(self):
        return models.Notification.objects.filter(pk__in=[n for n in self.request.query_params['ids'].split(',') if n.isdigit()])

    def cont(self, objpks, **kwargs):
        for notif in objpks:
            if notif.unread:
                notif.unread = False
                notif.save()
        return status.HTTP_200_OK, str(objpks.count())+" notifications have been marked as read."

class SendNotifsAPIView(BaseNotifAPIView):
    def t(self):
        return [n for n in self.request.query_params['to'].split(',') if n.isdigit()]

    def cont(self, objpks, **kwargs):
        try:
            event = models.Event.objects.get(pk=kwargs['pk'])
        except:
            st = status.HTTP_404_NOT_FOUND
            text = "Event not found."
        else:
            persons = User.objects.filter(pk__in=objpks)
            cnt = 0
            for person in persons:
                if self.request.user != person and not models.EventNotification.objects.filter(from_person=self.request.user, to_person=person, content_type=ContentType.objects.get(model='event'), object_id=event.pk).exists():
                    models.EventNotification.objects.create(from_person=self.request.user, to_person=person, content_type=ContentType.objects.get(model='event'), object_id=event.pk)
                    cnt += 1
            st = status.HTTP_200_OK
            text = str(cnt)+" persons have been notified."
        return st, text


def get_loc(self, qs, f=True, loc=False, store=False, deford=True):
    if 'pos' not in self.kwargs:
        try:
            pos = fromstr('POINT('+self.request.query_params['position'].replace(',', ' ')+')', srid=4326)
            if qs:
                pos.transform(3857)
        except:
            pos = self.request.user.loc_projected if qs else self.request.user.location
        if store:
            self.kwargs['pos'] = pos
    else:
        if self.kwargs['pos'].srid == 4326:
            if self.kwargs['pos'] != self.request.user.location:
                self.kwargs['pos'].transform(3857)
            else:
                self.kwargs['pos'] = self.request.user.loc_projected
        pos = self.kwargs['pos']
    if qs is not None:
        if f:
            if isinstance(f, bool):
                f = 'business'
            f += '__'
        else:
            f = ''
        if loc:
            qs = qs.filter(**{f+'loc_projected__distance_lte': (pos, D(km=self.request.query_params['distance'] if 'distance' in self.request.query_params and self.request.query_params['distance'].replace('.','',1).isdigit() else 5))})
        if loc is not None:
            qs = qs.annotate(distance=Distance(f+'loc_projected', pos)).order_by('distance')
        return qs.order_by(*qs.model._meta.ordering) if deford else qs

def filter_published(self, ct_f=False, model=None):
    if not model:
        model = self.model
    if isinstance(ct_f, str):
        ct_f = ContentType.objects.get(model=ct_f).pk
    if self.request.user.is_staff:
        return model.objects.filter(content_type__pk=ct_f).extra(where=[serializers.gen_where(model._meta.db_table.split('_')[1], target='business', ct=ct_f, where='exists (select 1 from main_item inner join '+model._meta.db_table+' on main_item.business_id = '+model._meta.db_table+'.object_id)')]) if not isinstance(ct_f, bool) else model.objects.extra(where=['exists (select 1 from main_item inner join main_business on main_item.business_id = main_business.id)'])
    return model.objects.filter(content_type__pk=ct_f).extra(where=[serializers.gen_where(model._meta.db_table.split('_')[1], 'True', column='is_published', target='business', ct=ct_f)]) if not isinstance(ct_f, bool) else model.objects.filter(**{('business__' if ct_f else '')+'is_published': True})

class FeedAPIView(MultipleModelAPIView):
    pagination_class = pagination.FeedPagination
    sorting_field = '-sort_field'
    flat = True
    max = 20

    def get_queryList(self):
        def get_friends_qs(model, filter='business__manager', rel=None, ct=None):
            """
            @type model: django.db.models.Model
            """
            qs = filter_published(self, ct or filter is not None, model)
            if filter:
                qs = qs.filter(Q(**{filter + '__in': friends}) | Q(likes__person__in=friends)).annotate(is_liked=Max(Case(When(likes__person__in=friends, then=1), default=0, output_field=IntegerField())), sort_field=Max(Case(When(likes__person__in=friends, then=F('likes__date')), default=F('created')))) #.distinct('pk')
            else:
                qs = qs.filter(likes__person__in=friends).annotate(sort_field=F('likes__date'))
            return get_loc(self, qs, rel or filter is not None, store=True)[:self.max]

        friends = list(serializers.friends_from(self.request.user).values_list('pk', flat=True))
        return [(get_friends_qs(models.Business, None), serializers.BusinessSerializer),
                (get_friends_qs(models.Event), serializers.EventSerializer),
                (get_friends_qs(models.Item), serializers.ItemSerializer),
                (get_friends_qs(models.Review, 'person', 'object', 'business'), serializers.CommentSerializer, 'comment'),
                (models.Relationship.objects.filter(Q(from_person__in=friends) | Q(to_person__in=friends)).filter(symmetric=True).exclude(to_person=self.request.user).exclude(from_person=self.request.user).annotate(rev_dir=Case(When(to_person__in=friends, then=1), default=0, output_field=IntegerField()), sort_field=F('notification__created')).defer('notification', 'symmetric')[:self.max], serializers.RelationshipSerializer, 'user')]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['feed'] = None
        return context


class BaseAPIView(IsOwnerOrReadOnly, generics.ListCreateAPIView, generics.DestroyAPIView):
    pagination_class = pagination.EventPagination
    def_pagination_class = pagination.CommentDefPagination
    filter = 'business__manager'
    order_by = 'created'
    ct = None
    s_rev = False

    def __init__(self):
        super().__init__()
        self.main_f = self.ct or True

    def get_person_qs(self, person):
        qs = filter_published(self, self.main_f).filter(Q(**{self.filter: person}) | Q(likes__person=person))
        return qs.annotate(sort=Max(Case(When(likes__person=person, then=F('likes__date')), default=F(self.order_by)))) if self.order_by else qs

    def get_qs_pk(self):
        b = get_object(self.kwargs['pk'], models.Business)
        if 'business' in self.kwargs:
            self.kwargs['business'] = b
        return self.model.objects.filter(business=b)

    def order_qs(self, qs):
        return qs

    def getnopk(self):
        return filter_published(self, self.main_f)

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
            qs = self.get_person_qs(person)
        elif self.request.method == 'GET' and self.kwargs['pk']:
            qs = self.order_qs(self.get_qs_pk())
            #self.kwargs['person_business'] = True
        elif self.request.method == 'GET':
            qs = self.getnopk()
        elif self.kwargs['pk']:
            qs = self.model.objects.filter(pk=self.kwargs['pk'])
        else:
            return self.model.objects.none()
        return qs

    def paginate_queryset(self, queryset):
        if not self.request.query_params.get('ids', False):
            if self.filter_backends and self.request.query_params.get('search', False):
                self.pagination_class = pagination.SearchPagination
            elif self.order_by and get_param_bool(self.request.query_params.get('is_person', False)):
                self.pagination_class = pagination.UserPagePagination
            elif self.s_rev != get_param_bool(self.request.query_params.get('reverse', False)):
                self.pagination_class = self.def_pagination_class
            return super().paginate_queryset(queryset)
        return None

    def get_serializer_context(self):
        context = super().get_serializer_context()
        for f in ('home', 'search'):
            if f in self.kwargs:
                context[f] = None
        if 'person' in self.kwargs:
            context['person'] = self.kwargs['person']
        if self.request.query_params.get('no_business', False):
            context['hiddenbusiness'] = None
        return context

def get_t_pkn(obj, dic=None, s=False):
    """
    @type obj: django.views.generic.base.View
    """
    if 'ct_pkn' not in obj.kwargs:
        obj.kwargs['ct_pkn'] = obj.request.data.get('content_type', None) or obj.request.query_params.get('content_type', None)
        if obj.kwargs['ct_pkn'] and isinstance(obj.kwargs['ct_pkn'], str) and obj.kwargs['ct_pkn'].isdigit():
            obj.kwargs['ct_pkn'] = int(obj.kwargs['ct_pkn'])
    pkn = obj.kwargs['ct_pkn']
    if dic and pkn and (pkn not in dic if isinstance(dic, list) or isinstance(pkn, int) else (pkn not in dic.values() and pkn not in dic)):
        return False if not s else pkn
    if pkn:
        return pkn if not s else True

def get_type(obj):
    """
    @type obj: django.views.generic.base.View
    """
    if 'ct' not in obj.kwargs:
        pkn = get_t_pkn(obj)
        if pkn:
            try:
                pkn = ContentType.objects.get(**{'pk' if isinstance(pkn, int) else 'model': pkn})
            except:
                raise NotFound("Content type not found.")
        obj.kwargs['ct'] = pkn
    return obj.kwargs['ct']

def get_qs(obj_v, model):
    """
    @type obj_v: django.views.generic.base.View
    """
    ct = get_type(obj_v)
    obj = get_object(obj_v.kwargs['pk'], ct.model_class() if ct else models.Event)
    return model.objects.filter(content_type=ct or ContentType.objects.get(model='event'), object_id=obj.pk)

def set_t(obj_v, context):
    """
    @type obj_v: django.views.generic.base.View
    """
    pkn = get_t_pkn(obj_v, models.get_has_stars(), True)
    if pkn is True:
        context['stars'] = None
    elif pkn in ('business', ContentType.objects.get(model='business').pk):
        context['business'] = None
    else:
        return False
    return True

@table_session_check()
class CommentAPIView(BaseAPIView):
    serializer_class = serializers.CommentSerializer
    model = models.Comment
    filter = 'person'
    ct = 'business'
    s_rev = True

    def getnopk(self):
        return self.order_qs(self.get_person_qs(self.request.user))

    def get_person_qs(self, person):
        return super().get_person_qs(person).annotate(is_liked=Case(When(likes__person=person, then=1), default=0, output_field=IntegerField()))

    def get_qs_pk(self):
        return get_qs(self, models.Comment)

    def order_qs(self, qs):
        if not self.request.query_params.get('ids', False):
            """if 'business' in self.get_serializer_context(True):
                qs = qs.order_by(Case(When(person=self.request.user, then=Value(0)), output_field=IntegerField()), *models.Comment._meta.ordering)
            else:"""
            if not get_param_bool(self.request.query_params.get('reverse', False)):
                self.pagination_class = pagination.CommentDefPagination
            else:
                self.pagination_class = pagination.CommentPagination
        return qs

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get('ids', False):
            return qs.filter(content_type=ContentType.objects.filter(model='business'))
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
            co.main_comment = models.Comment.objects.filter(content_type=ContentType.objects.get(model='comment'), object_id=co.pk, status__isnull=False).last()
            if co.main_comment:
                co.save()
                return Response(data=serializers.CommentSerializer(co.main_comment, context=self.get_serializer_context()).data)
        else:
            obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

@table_session_check()
class EventAPIView(BaseAPIView):
    serializer_class = serializers.EventSerializer
    model = models.Event
    filter_backends = (SearchFilter,)
    search_fields = ('text',) #'business__name'

    def getnopk(self):
        if not isinstance(self, EventAPIView):
            self.model = models.Event
            self.main_f = True
            qs = BaseAPIView.getnopk(self)
        else:
            qs = super().getnopk()
            self.kwargs['search'] = None
        if get_param_bool(self.request.query_params.get('favourites', False)):
            return get_loc(self, qs.extra(where=[serializers.gen_where('event', self.request.user.pk, 'like', 'person', 'business', ct=ContentType.objects.get(model='business').pk)]))
        return get_loc(self, qs, loc=not self.request.query_params.get('search', False)) #, store=not isinstance(self, EventAPIView)

@table_session_check(True)
class ItemAPIView(BaseAPIView, generics.UpdateAPIView):
    serializer_class = serializers.ItemSerializer
    model = models.Item
    filter_backends = (SearchFilter,)
    search_fields = ('name',)

    def getnopk(self):
        qs = super().getnopk()
        if self.request.query_params.get('search', False):
            self.kwargs['search'] = None
            return get_loc(self, qs, deford=False) #.order_by(Case(When(Q(business__currency=self.request.user.currency) | Q(business__supported_curr__contains=self.request.user.currency), then=Value(0)), output_field=IntegerField()), *models.Item._meta.ordering)
        return qs.filter(business=get_b_from(self.request.user))

    def get_queryset(self):
        self.kwargs['business'] = None
        qs = super().get_queryset()
        if not self.request.query_params.get('ids', False) and 'currency' in self.kwargs: #or get_param_bool(self.request.query_params.get('menu', False)))
            #qs = qs.order_by() #'name', 'category'
            #if 'currency' in self.kwargs:
            serializers.mass_convert(qs, self.kwargs['business'] or qs[0].business, self.kwargs['currency'])
        return qs

    def paginate_queryset(self, queryset):
        if 'currency' not in self.kwargs and not get_param_bool(self.request.query_params.get('menu', False)):
            return super().paginate_queryset(queryset)
        return None

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if 'currency' in self.kwargs:
            context['currency'] = None
            self.kwargs.pop('currency')
        elif self.request.method in ('PATCH', 'PUT'):
            context['edit'] = None
        elif self.request.query_params.get('ids', False):
            context['ids'] = get_param_bool(self.request.query_params.get('has_img_ind', False))
        elif not get_param_bool(self.request.query_params.get('is_person', False)) and get_param_bool(self.request.query_params.get('menu', False)):
            context['menu'] = None
        return context

    def update(self, request, *args, **kwargs):
        if hasattr(request.data, '_mutable'):
            request.data._mutable = True
        if 'currency' in request.data and request.data['currency'] in tuple(i[0] for i in models.CURRENCY):
            self.kwargs['currency'] = request.data.pop('currency')[0] if hasattr(request.data, '_mutable') else request.data.pop('currency')
            request.method = 'GET'
            return super().list(request, *args, **kwargs)
        request.data.pop('name', None)
        return super().update(request, *args, **kwargs)

    def delete(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.business.item_set.count() == 1:
            raise serializers.gen_err("The last remaining item can't be deleted.")
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MultiBaseAPIView(MultipleModelAPIView):
    def prep_chk(self, page_size=None, cursor=None):
        self.kwargs['page_size'] = page_size or (self.pagination_class.page_size if not cursor else cursor.page_size)
        if not cursor and hasattr(self, 'pagination_class') and hasattr(self.pagination_class, 'cursor_query_param'):
            cursor = self.pagination_class
        if cursor:
            self.ordering = cursor.ordering
        def chk(queryset, request, *args, **kwargs):
            self.kwargs[queryset.model.__name__] = True if queryset.count() == self.kwargs['page_size'] + 1 else None
            if queryset.count() >= self.kwargs['page_size']:
                queryset = queryset[:self.kwargs['page_size']]
                if self.kwargs[queryset.model.__name__] and cursor:
                    self.kwargs[queryset.model.__name__] = cursor.encode_cursor(self, Cursor(offset=0, reverse=False, position=cursor._get_position_from_instance(self, list(queryset)[-1], cursor.get_ordering(self, request, queryset, None))))[0]
            return queryset
        self.kwargs['chk_fn'] = chk

    def gen_qli(self, qs, ser=None, page_size=None, cursor=None):
        if page_size or cursor:
            self.prep_chk(page_size, cursor)
        return Query(qs[:self.kwargs['page_size'] + 1], ser or self.serializer_class, filter_fn=self.kwargs['chk_fn'])

    def format_data(self, new_data, query, results):
        if self.flat:
            return super().format_data(new_data, query, results)
        new_data = {'results': new_data}
        if query.queryset.model.__name__ in self.kwargs:
            new_data['next'] = self.kwargs.pop(query.queryset.model.__name__)
        results.append(new_data)
        return results

class HomeAPIView(MultiBaseAPIView):
    def get_queryList(self):
        get_loc(self, None, store=True)
        self.request.session['timezone'] = models.TF_OBJ.timezone_at(lat=self.kwargs['pos'].coords[1], lng=self.kwargs['pos'].coords[0])
        return [(BusinessAPIView.get_queryset(self), serializers.BusinessSerializer), self.gen_qli(EventAPIView.getnopk(self), serializers.EventSerializer, cursor=pagination.EventPagination)]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['home'] = None
        return context

    def format_data(self, new_data, query, results):
        if not results:
            results.append(self.request.session['timezone'])
        return super().format_data(new_data, query, results)

class BaseLikeView(generics.GenericAPIView):
    serializer_class = serializers.LikeSerializer
    pagination_class = pagination.LikePagination

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

def like_switch_view(request, pk=None):
    if pk and get_param_bool(request.GET.get('init', False)):
        return InitLikeAPIView.as_view()(request, pk=pk)
    return LikeAPIView.as_view()(request, pk=pk)

class InitLikeAPIView(BaseLikeView, MultiBaseAPIView):
    add_model_type = False

    def gen_qs(self, qs, filter, range):
        self.prep_chk()
        ret = []
        for v in range:
            ret.append(self.gen_qli(qs.filter(**{filter: v}))) #serializers.sort_related(..., self.request.user)
        return ret

    def get_queryList(self):
        qs = get_qs(self, models.Like)
        return self.gen_qs(qs, 'stars', range(1, 6)) if 'stars' in self.get_serializer_context(True) else self.gen_qs(qs, 'is_dislike', [False, True])

class LikeAPIView(IsOwnerOrReadOnly, BaseLikeView, generics.ListCreateAPIView, generics.UpdateAPIView, generics.DestroyAPIView):
    def get_serializer_class(self):
        if self.request.method == 'GET' and 'is_user' in self.kwargs:
            if self.kwargs['is_user']:
                self.serializer_class = serializers.BusinessSerializer
            else:
                self.serializer_class = serializers.UserSerializer
        return self.serializer_class

    def get_queryset(self):
        if not self.kwargs['pk'] or get_type(self) and self.kwargs['ct'].model == 'business':
            pk = self.kwargs['pk']
            self.kwargs['is_user'] = get_param_bool(self.request.query_params.get('is_person', False))
            if self.kwargs['is_user']:
                if get_type(self) and self.kwargs['ct'].model == 'business':
                    self.kwargs['notype'] = None
                if pk and pk != self.request.user.pk:
                    person = get_object(pk)
                    return models.Business.objects.filter(likes__person=person).annotate(date=F('likes__date')) #serializers.sort_related(..., models.Business.objects.filter(manager=self.request.user).first(), serializers.gen_where('business', self.request.user.pk, 'like', 'person', ct=ContentType.objects.get(model='business').pk))
                return models.Business.objects.filter(likes__person=self.request.user).annotate(date=F('likes__date')) #serializers.sort_related(,,,, where=serializers.gen_where('business', self.request.user.pk, 'recent', 'user', ct=ContentType.objects.get(model='business').pk)
            business = get_object(pk, models.Business) if pk else get_b_from(self.request.user)
            return User.objects.filter(like__content_type=ContentType.objects.get(model='business'), like__object_id=business.pk).annotate(date=F('like__date')) #serializers.sort_related(..., self.request.user, serializers.gen_where('user', self.request.user.pk, 'relationship'))
        qs = get_qs(self, models.Like)
        if 'stars' not in self.get_serializer_context(True):
            if self.request.query_params.get('is_dislike', False):
                qs = qs.filter(is_dislike=get_param_bool(self.request.query_params['is_dislike']))
            else:
                self.kwargs['context']['showtype'] = None
        else:
            stars = self.request.query_params.get('stars', False)
            if stars and stars.isdigit() and 1 <= int(stars) <= 5:
                qs = qs.filter(stars=stars)
            else:
                self.kwargs['context']['showtype'] = None
        return qs #serializers.sort_related(, self.request.user)

    def get_object(self):
        return get_object_or_404(models.Like, content_type=get_type(self) or ContentType.objects.get(model='event'), object_id=self.kwargs['pk'], person=self.request.user)


class ReminderAPIView(IsOwnerOrReadOnly, generics.ListCreateAPIView, generics.DestroyAPIView):
    serializer_class = serializers.ReminderSerializer
    pagination_class = pagination.ReminderPagination

    def get_queryset(self):
        if self.request.method == 'GET':
            """if self.kwargs['pk']:
                person = get_object(self.kwargs['pk'])
            else:
                person = self.request.user"""
            return models.EventNotification.objects.filter(to_person=self.request.user, comment_type=None) #person
        return models.EventNotification.objects.filter(pk=self.kwargs['pk']) if self.kwargs['pk'] else models.EventNotification.objects.none()


class RecentAPIView(MultipleModelAPIView):
    def get_queryList(self):
        return [(gen_recent_qs(self.request, models.User)[:5], serializers.UserSerializer),
                 (gen_recent_qs(self.request, models.Business)[:5], serializers.BusinessSerializer)]