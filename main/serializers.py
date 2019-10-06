#from django.contrib.auth import update_session_auth_hash
#from rest_framework.fields import Field
from django.utils import timezone
from django.core.validators import MinLengthValidator
from datetime import timedelta
from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator
from rest_framework.relations import PrimaryKeyRelatedField
from allauth.account import signals
from allauth.account.models import EmailAddress
from . import models
from django.contrib.auth import get_user_model
from rest_framework.compat import unicode_to_repr
from django.contrib.contenttypes.models import ContentType
from os import path
from django.db.models import Count, Avg, Case, When, Value, IntegerField
from django.core.cache import caches
from requests import get as req_get
from json import loads
from decimal import Decimal, ROUND_HALF_UP
from .forms import clean_loc, business_clean_data
from django.core.exceptions import ObjectDoesNotExist
from pytz import timezone as get_timezone, common_timezones
from rest_framework_simplejwt.serializers import TokenObtainSerializer, TokenRefreshSerializer as DefTokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings

User = get_user_model()

APP_LABEL = path.basename(path.dirname(__file__))
def gen_where(model, pk=None, table=None, column=None, target=None, ct=None, where=None): #, col_add=None, additional_obj=None
    if not target:
        target = model
    col_add = 'person_' if model != 'user' and target == 'relationship' else 'from_person_' if model == 'relationship' else 'object_' if not table and ct else target+'_' if target != 'relationship' and target != model else ''
    return '''
        {app_label}_{model}.{col_add}id in
        (select {app_label}_{target}.{sel_add}id from {app_label}_{target}
        {inner_join}
        where {where})
        '''.format(app_label=APP_LABEL, model=model, col_add=col_add, sel_add='to_person_' if target == 'relationship' else '', target=target, #{additional}
            inner_join='inner join {app_label}{add_user}_{table} on ({app_label}_{target}.id = {app_label}{add_user}_{table}.{on_col}_id{content_type})'.format(app_label=APP_LABEL, add_user='_user' if table != 'relationship' and not column and (table or not ct) else '', table=table or model, target=target,
                on_col=('to' if model == 'relationship' else 'from')+'_person' if table == 'relationship' else 'object' if column in ('person', 'user') or not pk else 'person' if target == 'user' else 'object' if not table and ct else target, content_type=' and {app_label}_{table}.content_type_id = {ct}'.format(app_label=APP_LABEL, table=table or model, ct=ct) if ct else '') if table or ct else '',
            where='{column} = {pk}'.format(column='main_relationship.from_person_id' if not table and not ct or table == 'relationship' else '{app_label}{add_user}_{table}.{column}'.format(app_label=APP_LABEL, add_user = '_user' if model != 'user' and column not in ('person', 'user') and (table or not ct) else '', table=table or target, column=(column or 'user')+('_id' if table or not ct else '')), pk=pk) if not where else where#,
            )#additional='or {app_label}_{model}.{col_add}id = {additional_pk}'.format(app_label=APP_LABEL, model=model, col_add=col_add, additional_pk=additional_obj.pk) if additional_obj else '')

def sort_related(query, first=None, where=None, retothers=False):
    """
    @type query: django.db.models.QuerySet
    """
    others = query.extra(where=[where if where else gen_where(query.model.__name__.lower(), first.pk, target='relationship')])
    if retothers:
        return others
    if first:
        cases = [When(pk=first.pk, then=Value(0))]
        s = 1
    else:
        cases = []
        s = 0
    cases += [When(pk=obj.pk, then=Value(i+s)) for i, obj in enumerate(others.all())]
    return query.order_by(Case(*cases, output_field=IntegerField()), *query.model._meta.ordering) if len(cases) > 0 else query


REVIEW_MIN_CHAR = 6

def gen_coords(obj):
    return {'lat': obj.coords[1], 'lng': obj.coords[0]}

def gen_token(token):
    return {'token': str(token), 'exp': token['exp']}

class TokenObtainPairSerializer(TokenObtainSerializer):
    @classmethod
    def get_token(cls, user):
        token = RefreshToken.for_user(user)
        token['pw_l_c'] = user.pass_last_changed
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        refresh = self.get_token(self.user)
        data['refresh'] = gen_token(refresh)
        data['access'] = gen_token(refresh.access_token)
        data['NOTIF_PAGE_SIZE'] = settings.NOTIFICATION_PAGE_SIZE
        if self.user.is_manager:
            data['EVENT_MIN_CHAR'] = models.EVENT_MIN_CHAR
            data['ITEM_MIN_CHAR'] = models.ITEM_MIN_CHAR
        data['REVIEW_MIN_CHAR'] = REVIEW_MIN_CHAR
        data['user'] = {'id': self.user.pk, 'username': self.user.username, 'first_name': self.user.first_name, 'last_name': self.user.last_name, 'currency': self.user.currency, 'location': gen_coords(self.user.location)}
        return data

class TokenRefreshSerializer(DefTokenRefreshSerializer):
    def validate(self, attrs):
        return gen_token(RefreshToken(attrs['refresh']).access_token)


def gen_err(msg):
    return serializers.ValidationError({'non_field_errors': [msg]})

class EmailSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    password = serializers.CharField(max_length=128, required=True, write_only=True)

    class Meta:
        model = EmailAddress
        exclude = ('id', 'user')

    def __init__(self, *args, **kwargs):
        kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        if self.context['request'].method not in ('PUT', 'PATCH'):
            self.fields['primary'].read_only = True
            self.fields['verified'].read_only = True
        else:
            self.fields['email'].read_only = True

    def validate_password(self, value):
        if not self.context['request'].user.check_password(value):
            raise serializers.ValidationError("Invalid password")
        return value

    def send_signal_email_changed(self, from_email, to_email):
        signals.email_changed \
            .send(sender=self.context['request'].user.__class__,
                  request=self.context['request'],
                  user=self.context['request'].user,
                  from_email_address=from_email,
                  to_email_address=to_email)

    def primary_first_email(self, obj, msg):
        o = obj.user.emailaddress_set.exclude(pk=obj.pk).filter(verified=True).first()
        if o:
            o.set_as_primary()
            self.send_signal_email_changed(obj, o)
        else:
            raise gen_err(msg)

    def update(self, instance, validated_data):
        if 'primary' not in validated_data and 'verified' not in validated_data:
            if instance.primary:
                self.primary_first_email(instance, "The only verified email address can't be deleted.")
            instance.delete()
            signals.email_removed.send(sender=self.context['request'].user.__class__,
                                       request=self.context['request'],
                                       user=self.context['request'].user,
                                       email_address=instance)
            del instance.email, instance.primary, instance.verified
        else:
            if 'primary' in validated_data:
                if not validated_data['primary']:
                    self.primary_first_email(instance, "Can't change primary status of the only verified email address.")
                elif not instance.verified:
                    raise gen_err("Can't set unverified email address as primary.")
                instance.set_as_primary()
                self.send_signal_email_changed(None, instance)
            if 'verified' in validated_data and not instance.verified:
                instance.send_confirmation(self.context['request'])
        return instance

    def create(self, validated_data):
        obj = EmailAddress.objects.add_email(self.context['request'], self.context['request'].user, self.validated_data['email'], confirm=True)
        signals.email_added.send(sender=self.context['request'].user.__class__,
                                 request=self.context['request'],
                                 user=self.context['request'].user,
                                 email_address=obj)
        return obj


def get_rate(f, t):
    r = caches['rates'].get(f+t)
    if r:
        return r
    r = loads(req_get('http://data.fixer.io/api/latest?access_key=***REMOVED***').text)['rates']
    r = Decimal(r[t]/r[f])
    caches['rates'].set(f+t, r)
    return r

ZERO_DECIMAL = Decimal(0)
def curr_convert(v, f, t=None):
    return (Decimal(v) * (get_rate(f, t) if t else f)).quantize(Decimal('.01'), rounding=ROUND_HALF_UP) if Decimal(v) != ZERO_DECIMAL else 0

def mass_convert(qs_pk, obj, to_curr):
    if obj.currency == to_curr:
        return #True
    if isinstance(qs_pk, int):
        qs_pk = models.Item.objects.filter(business=qs_pk)
    if not qs_pk.exists():
        return
    rate = get_rate(obj.currency, to_curr)
    rem = None
    try:
        obj.supported_curr.remove(to_curr)
    except:
        pass
    else:
        rem = True
    for i in qs_pk:
        i.price = curr_convert(i.price, rate)
        i.save()
    if not isinstance(qs_pk, int) or rem:
        if not isinstance(qs_pk, int):
            obj.currency = to_curr
        obj.save()


class DateTimeFieldWihTZ(serializers.DateTimeField):
    #format = '%d %b %Y %I:%M %p'

    def to_representation(self, value):
        value = timezone.localtime(value)
        return super().to_representation(value)

class NotificationSerializer(serializers.ModelSerializer):
    created = DateTimeFieldWihTZ()

    class Meta:
        model = models.Notification
        exclude = ('user',)


def extarg(kwargs, name, obj=None):
    if name in kwargs:
        res = kwargs[name]
        kwargs.pop(name)
    else:
        res = False
    if obj:
        setattr(obj, name, res)
    else:
        return res

def friends_from(user, only=False, qs=None):
    where = gen_where('relationship', user.pk, 'relationship', 'id', 'user')
    if not qs:
        qs = User.objects.filter(from_person__to_person=user).extra(where=[where])
    else:
        qs = qs.extra(where=[gen_where(qs.model.__name__.lower(), user.pk, 'relationship', 'id', 'user', where='(%s_relationship.to_person_id = %d and %s)' % (APP_LABEL, user.pk, where))])
    return qs.only('id', 'username', 'first_name', 'last_name') if only else qs

def get_rel_state(request, person):
    if request.user != person:
        res = 0
        if models.Relationship.objects.filter(from_person=request.user, to_person=person).exists():
            res = 1
        if models.Relationship.objects.filter(from_person=person, to_person=request.user).exists():
            res += 2
        return res
    return -1

class BaseURSerializer(serializers.ModelSerializer):
    def __init__(self, *args, **kwargs):
        kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        if isinstance(self, UserSerializer) and ('single' in self.context or 'list' in self.context) or 'feed' in self.context:
            self.fields['friend_count'] = serializers.SerializerMethodField()
            self.fields['rel_state'] = serializers.SerializerMethodField()

    def get_p(self, obj):
        if isinstance(obj, models.Relationship):
            if obj.rev_dir:
                return obj.from_person
            return obj.to_person
        return obj

    def get_friend_count(self, obj):
        person = self.get_p(obj)
        friends = friends_from(person, True)
        return [friends.count(), sort_related(friends, self.context['request'].user, retothers=True).count()]

    def get_rel_state(self, obj):
        return get_rel_state(self.context['request'], self.get_p(obj))

class UsersWithoutCurrentField(serializers.PrimaryKeyRelatedField):
    def get_queryset(self):
        qs = User.objects.all()
        if 'request' in self.context: #and self.context['request'].user.is_authenticated:
            qs = qs.exclude(pk=self.context['request'].user.pk)
        return qs

class RelationshipSerializer(BaseURSerializer):
    class Meta:
        model = models.Relationship
        exclude = ('id', 'from_person', 'to_person', 'notification', 'symmetric') #extra_kwargs = {
        #    'notification': {'read_only': True},
        #}
        validators = [
            UniqueTogetherValidator(
                queryset=models.Relationship.objects.all(),
                fields=('from_person', 'to_person'),
                message="Such relationship already exists."
            )
        ]

    def __init__(self, *args, **kwargs):
        kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        if 'feed' in self.context:
            self.fields['target'] = serializers.SerializerMethodField()
            self.fields['friend'] = serializers.SerializerMethodField()
            self.fields['sort_field'] = serializers.DateTimeField()
        else:
            self.fields['from_person'] = serializers.PrimaryKeyRelatedField(read_only=True, default=serializers.CurrentUserDefault())
            self.fields['to_person'] = UsersWithoutCurrentField()

    def get_friend(self, obj):
        return UserSerializer(obj.to_person if obj.rev_dir else obj.from_person).data #, context={'noid': None}

    def get_target(self, obj):
        return UserSerializer(obj.from_person if obj.rev_dir else obj.to_person).data


TIMEZONES = [tz for tz in common_timezones]
class UserSerializer(BaseURSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'first_name', 'last_name', 'gender', 'birthdate', 'address', 'currency', 'language')
        extra_kwargs = {'username': {'read_only': True}, 'first_name': {'required': False}, 'last_name': {'required': False}, 'birthdate': {'required': False}, 'address': {'required': False}}

    def __init__(self, *args, **kwargs):
        kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        if 'noid' in self.context:
            self.fields.pop('id')
        if 'status' in self.context:
            self.fields['status'] = serializers.SerializerMethodField()
        if 'single' not in self.context:
            self.fields['first_name'].read_only = True
            self.fields['last_name'].read_only = True
            self.fields.pop('gender')
            self.fields.pop('address')
        else:
            if 'owner' in self.context:
                self.fields['tz'] = serializers.ChoiceField(TIMEZONES)
                self.fields['location'] = serializers.SerializerMethodField()
            self.fields['born_ago'] = serializers.SerializerMethodField()
        if 'owner' not in self.context:
            self.fields.pop('currency')
            self.fields.pop('language')
            self.fields.pop('birthdate')

    def validate(self, attrs):
        if 'birthdate' in attrs and (attrs['birthdate'].year > 2015 or attrs['birthdate'].year < 1927):
            raise serializers.ValidationError({'birthdate': ["Invalid birthdate."]})
        if self.context['request'].user.name_changed and ('first_name' in attrs and attrs['first_name'] != self.context['request'].user.first_name or 'last_name' in attrs and attrs['last_name'] != self.context['request'].user.last_name):
            raise serializers.ValidationError("Your name was already changed once.")
        for f in ('gender', 'birthdate'):
            if f in attrs and getattr(self.context['request'].user, f+'_changed') and attrs[f] != getattr(self.context['request'].user, f):
                raise serializers.ValidationError("Your %s was already changed once." % f) #models.User._meta.get_field(f).verbose_name
        return attrs

    def update(self, instance, validated_data):
        if 'address' in validated_data:
            instance.location = clean_loc(self, validated_data, True)
        if not self.context['request'].user.name_changed:
            instance.name_change = 'first_name' in validated_data and validated_data['first_name'] != instance.first_name or 'last_name' in validated_data and validated_data['last_name'] != instance.last_name
        for f in ('gender', 'birthdate'):
            if not getattr(instance, f+'_changed'):
                setattr(instance, f+'_changed', f in validated_data and validated_data[f] != getattr(instance, f))
        return super().update(instance, validated_data)

    def get_location(self, obj):
        return gen_coords(obj.location)

    def get_status(self, _):
        return self.context['status']

    def get_born_ago(self, obj):
        now = timezone.now()
        return now.year - obj.birthdate.year - ((now.month, now.day) < (obj.birthdate.month, obj.birthdate.day))


def get_friends(s, obj):
    context = {'noid': None} if not isinstance(obj, models.Review) or not obj.is_liked else {}
    if isinstance(obj, models.Business) or obj.is_liked:
        qs = friends_from(s.context['request'].user, True, qs=User.objects.filter(like__content_type__pk=ContentType.objects.get_for_model(obj).pk, like__object_id=obj.pk))
        if qs.count() == 1:
            qs = qs[0]
            if not isinstance(obj, models.Business):
                ls = obj.likes.get(person=qs)
                context['status'] = ls.stars if ls.stars else 2 if ls.is_dislike else 1
            return UserSerializer(qs, context=context).data
        return {'objs': UserSerializer(qs[:3], many=True, context=context).data, 'count': qs.count()}
    context['status'] = -1
    return UserSerializer(obj.manager if isinstance(obj, models.Business) else obj.business.manager if not isinstance(obj, models.Review) else obj.person, context=context).data

def gen_distance(obj):
    return {'value': round(obj.distance.km, 1), 'unit': 'km'} if obj.distance.km > 0.8 else {'value': round(obj.distance.m), 'unit': 'm'}


class CoordinatesField(serializers.CharField):
    def to_representation(self, obj):
        return gen_coords(obj)

CURRENCY_ARR = tuple(i[0] for i in models.CURRENCY)
class BusinessSerializer(serializers.ModelSerializer):
    supported_curr = serializers.MultipleChoiceField(choices=models.CURRENCY)

    class Meta:
        model = models.Business
        exclude = ('manager', 'currency', 'location', 'loc_projected', 'is_published', 'tz', 'created')
        extra_kwargs = {'address': {'required': False}}

    def __init__(self, *args, **kwargs):
        currency = extarg(kwargs, 'currency')
        loc = extarg(kwargs, 'location')
        kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        if 'single' in self.context or 'list' in self.context or 'feed' in self.context or currency:
            if 'feed' in self.context:
                self.fields['sort_field'] = serializers.DateTimeField()
                self.fields['friend'] = serializers.SerializerMethodField()
            self.fields['currency'] = serializers.ChoiceField(choices=models.CURRENCY) #, source='get_currency_display'
            if not currency:
                self.fields['is_opened'] = serializers.SerializerMethodField()
                self.fields['item_count'] = serializers.IntegerField(source='item_set.count', read_only=True)
                self.fields['curruser_status'] = serializers.SerializerMethodField()
                self.fields['likestars_count'] = serializers.IntegerField(source='likes.count', read_only=True)
        if 'single' not in self.context:
            if 'notype' not in self.context:
                self.fields['type_display'] = serializers.CharField(source='get_type_display', read_only=True)
            self.fields['shortname'].read_only = True
            self.fields['name'].read_only = True
            self.fields.pop('type')
            self.fields.pop('address')
            self.fields.pop('phone')
            self.fields.pop('opened')
            self.fields.pop('opened_sat')
            self.fields.pop('opened_sun')
            self.fields.pop('closed')
            self.fields.pop('closed_sat')
            self.fields.pop('closed_sun')
            if 'list' not in self.context and 'feed' not in self.context:
                self.fields.pop('supported_curr')
            if loc or 'home' in self.context or 'feed' in self.context:
                self.fields['location'] = serializers.SerializerMethodField()
                if 'feed' in self.context or 'list' in self.context:
                    self.fields['distance'] = serializers.SerializerMethodField()
        else:
            self.fields['manager'] = serializers.HiddenField(default=serializers.CurrentUserDefault())
            self.fields['location'] = CoordinatesField(required=False)
            self.fields['tz'] = serializers.CharField(read_only=True)
            for f in ('opened', 'closed', 'opened_sat', 'closed_sat', 'opened_sun', 'closed_sun'):
                self.fields[f].format = '%H:%M'
            self.fields['rating'] = serializers.SerializerMethodField()

    def validate(self, attrs):
        business_clean_data(self, attrs, self.context['request'].method != 'POST')
        return attrs

    def validate_manager(self, obj):
        if models.Business.objects.filter(manager=obj).exists():
            raise serializers.ValidationError("You already have your own business.", code='unique')
        return obj

    def update(self, instance, validated_data):
        if 'currency' in validated_data and validated_data['currency'] in CURRENCY_ARR:
            mass_convert(instance.pk, instance, validated_data['currency'])
        return super().update(instance, validated_data)

    def get_distance(self, obj):
        return gen_distance(obj)

    def get_is_opened(self, obj):
        if isinstance(obj.tz, str):
            obj.tz = get_timezone(obj.tz)
        now = obj.tz.normalize(timezone.now())
        day = now.weekday()
        opened = obj.opened_sat if day == 5 and obj.opened_sat else obj.opened_sun if day == 6 and obj.opened_sun else obj.opened
        closed = obj.closed_sat if day == 5 and obj.closed_sat else obj.closed_sun if day == 6 and obj.closed_sun else obj.closed
        if opened >= closed:
            if opened > now.time():
                return now.time() < closed
            return True
        return opened <= now.time() < closed

    def get_curruser_status(self, obj):
        return -1 if self.context['request'].user == obj.manager else 1 if obj.likes.filter(person=self.context['request'].user).exists() else 0

    def get_friend(self, obj):
        return get_friends(self, obj)

    def get_location(self, obj):
        return gen_coords(obj.location)

    def get_rating(self, obj):
        qs = models.Review.objects.filter(object_id=obj.pk)
        if self.context['request'].user != obj.manager:
            o = qs.filter(person=self.context['request'].user).first()
        else:
            o = -1
        qs = qs.aggregate(Count('stars'), Avg('stars'))
        return [qs['stars__avg'] or 0, qs['stars__count'] or 0, o.stars if o and o != -1 else o or 0]


class CurrentBusinessDefault(object):
    def set_context(self, serializer_field):
        if isinstance(serializer_field, serializers.Serializer):
            sf = serializer_field.parent
        else:
            sf = serializer_field
        try:
            self.business = models.Business.objects.get(manager=sf.context['request'].user)
        except:
            self.business = None

    def __call__(self):
        return self.business

    def __repr__(self):
        return unicode_to_repr('%s()' % self.__class__.__name__)

def chktime(attrs, td=timedelta()):
    if attrs['when'] < timezone.now()+td:
        attrs['when'] = timezone.now()+td
    return attrs

NOT_MANAGER_MSG = "You're not a manager of any business."
def chkbusiness(business):
    if not business:
        raise serializers.ValidationError(NOT_MANAGER_MSG)

class BaseSerializer(serializers.ModelSerializer):
    likestars_count = serializers.SerializerMethodField()
    dislike_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    curruser_status = serializers.SerializerMethodField()

    def __init__(self, *args, **kwargs):
        extarg(kwargs, 'stars', self)
        kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        if 'feed' in self.context:
            self.fields['sort_field'] = serializers.DateTimeField()
            self.fields['friend'] = serializers.SerializerMethodField()
        if 'person' in self.context:
            self.fields['person_status'] = serializers.SerializerMethodField()
        if self.stars and 'menu' not in self.context and 'currency' not in self.context:
            self.fields['stars_avg'] = serializers.SerializerMethodField()
        #elif self.context['person_business'] == True:
        #    self.fields.pop('business')

    def validate(self, attrs):
        chkbusiness(attrs['business'])
        return attrs #, timedelta(minutes=1)

    def p_cont(self, obj, person, manager=None, stars=False, t=False):
        if (manager if manager else obj.business.manager) != person:
            try:
                ls = obj.likes.get(person=person)
            except:
                return 0
            if not self.stars and not stars:
                return [2 if ls.is_dislike else 1, ls.date] if t else 2 if ls.is_dislike else 1
            return [ls.stars, ls.date] if t else ls.stars
        if t:
            if not isinstance(obj, models.Review) and not isinstance(obj, models.Comment) and 'person' in self.context and self.context['person'] == self.context['request'].user:
                return [-1, obj.created]
            return [-1]
        return -1

    def p_status(self, obj, t=False):
        if t:
            person = self.context['person']
        elif 'request' in self.context: #and self.context['request'].user.is_authenticated
            person = self.context['request'].user
        else:
            return [-1] if t else -1
        return self.p_cont(obj, person, t=t)

    def get_curruser_status(self, obj):
        return self.p_status(obj)

    def get_person_status(self, obj):
        return self.p_status(obj, True)

    def get_likestars_count(self, obj):
        if not self.stars:
            return obj.likes.filter(is_dislike=False).count()
        return obj.likes.count()

    def get_stars_avg(self, obj):
        avg = obj.likes.aggregate(Avg('stars'))['stars__avg']
        return avg if avg else 0

    def get_dislike_count(self, obj):
        return obj.likes.filter(is_dislike=True).count()

    def get_comment_count(self, obj):
        return models.Comment.objects.filter(content_type__pk=ContentType.objects.get_for_model(obj).pk, object_id=obj.pk).count()

    def get_friend(self, obj):
        return get_friends(self, obj)

class EventSerializer(BaseSerializer):
    when = DateTimeFieldWihTZ()

    class Meta:
        model = models.Event
        exclude = ('business', 'created')

    def __init__(self, *args, **kwargs):
        kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        if 'hiddenbusiness' in self.context:
            self.fields['business'] = serializers.HiddenField(default=CurrentBusinessDefault())
        else:
            self.fields['business'] = BusinessSerializer(default=CurrentBusinessDefault(), location='search' in self.context or 'feed' in self.context)
            if 'home' in self.context or 'search' in self.context or 'feed' in self.context:
                self.fields['distance'] = serializers.SerializerMethodField()

    def get_distance(self, obj):
        return gen_distance(obj)

    def validate(self, attrs):
        return chktime(super().validate(attrs)) #, timedelta(minutes=1)

class ItemSerializer(BaseSerializer):
    class Meta:
        model = models.Item
        exclude = ('business', 'created')
        extra_kwargs = {'has_image': {'read_only': True}}
        validators = [
            UniqueTogetherValidator(
                queryset=models.Item.objects.all(),
                fields=('business', 'name', 'category'),
                message="An item with the same name already exists."
            )
        ]

    def __init__(self, *args, **kwargs):
        kwargs['stars'] = True
        kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        self.fields.pop('dislike_count')
        self.fields['converted'] = serializers.SerializerMethodField()
        if 'hiddenbusiness' in self.context or 'menu' in self.context or 'currency' in self.context:
            self.fields['business'] = serializers.HiddenField(default=CurrentBusinessDefault())
        else:
            self.fields['business'] = BusinessSerializer(default=CurrentBusinessDefault(), currency=True, location='search' in self.context or 'feed' in self.context)
        if 'menu' not in self.context and self.context['request'].method == 'GET':
            self.fields.pop('order')
        if 'menu' in self.context or 'currency' in self.context:
            self.fields.pop('curruser_status')
            self.fields.pop('likestars_count')
            self.fields.pop('comment_count')
            self.fields.pop('has_image')
            #self.fields.pop('stars_avg')
            if 'currency' in self.context:
                self.fields.pop('name')
        else:
            if 'ids' not in self.context:
                self.fields['category'].write_only = True
            elif not self.context['ids']:
                self.fields.pop('has_image')
            if 'hiddenbusiness' in self.context:
                self.fields['currency'] = serializers.CharField(source='business.currency', read_only=True)
            elif 'home' in self.context or 'search' in self.context or 'feed' in self.context:
                self.fields['distance'] = serializers.SerializerMethodField()
            if 'edit' in self.context:
                self.fields['name'].read_only = True
            self.fields['category_display'] = serializers.CharField(source='get_category_display', read_only=True)

    def get_distance(self, obj):
        return gen_distance(obj)

    def get_converted(self, obj):
        if obj.business.currency != self.context['request'].user.currency and self.context['request'].user.currency in obj.business.supported_curr:
            return str(curr_convert(obj.price, obj.business.currency, self.context['request'].user.currency))


class CurrentUserDefault(object):
    def set_context(self, serializer_field):
        if isinstance(serializer_field, serializers.Serializer):
            sf = serializer_field.parent
        else:
            sf = serializer_field
        self.user = sf.context['request'].user

    def __call__(self):
        return self.user

    def __repr__(self):
        return unicode_to_repr('%s()' % self.__class__.__name__)

class CTPrimaryKeyRelatedField(PrimaryKeyRelatedField):
    def to_internal_value(self, data):
        if self.pk_field is not None:
            data = self.pk_field.to_internal_value(data)
        try:
            return self.get_queryset().get(**{'model' if isinstance(data, str) else 'pk': data})
        except ObjectDoesNotExist:
            self.fail('does_not_exist', pk_value=data)
        except (TypeError, ValueError):
            self.fail('incorrect_type', data_type=type(data).__name__)

def get_from_ct(input):
    try:
        if input is True:
            return ContentType.objects.filter(pk__in=models.get_content_types_pk())
        return ContentType.objects.get(model=input)
    except:
        pass

class CTSerializer(serializers.Serializer):
    content_type = CTPrimaryKeyRelatedField(queryset=get_from_ct(True), write_only=True)

    def validate(self, attrs):
        try:
            attrs['content_object'] = attrs['content_type'].model_class().objects.get(pk=attrs['object_id'])
        except:
            raise serializers.ValidationError({'object_id': [CTPrimaryKeyRelatedField.default_error_messages['does_not_exist'].format(pk_value=attrs['object_id'])]})
        return attrs

class CommentSerializer(CTSerializer, BaseSerializer):
    person = UserSerializer(default=CurrentUserDefault())
    created = DateTimeFieldWihTZ(read_only=True)

    class Meta:
        model = models.Comment
        exclude = ('main_comment',)
        extra_kwargs = {'object_id': {'write_only': True}}

    def __init__(self, *args, **kwargs):
        likes = extarg(kwargs, 'likes')
        kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        if not self.read_only and not likes and ('person' in self.context or 'curruser' in self.context or 'business' in self.context or 'ids' in self.context or 'feed' in self.context):
            context = self.context.copy()
            if 'business' not in self.context:
                self.fields['content_object'] = BusinessSerializer(read_only=True, location='feed' in self.context)
                if 'ids' not in self.context:
                    context.pop('person', None)
                    context.pop('feed', None)
                    self.fields['person'] = serializers.SerializerMethodField()
            self.fields['main_comment'] = CommentSerializer(read_only=True, context=context)
            self.fields.pop('status')
            self.fields['text'].validators = [MinLengthValidator(REVIEW_MIN_CHAR)]
            self.fields['is_manager'] = serializers.SerializerMethodField()
            if 'feed' in self.context or 'list' in self.context:
                self.fields['distance'] = serializers.SerializerMethodField()
        else:
            if not likes:
                self.fields.pop('curruser_status')
                self.fields.pop('likestars_count')
                self.fields.pop('dislike_count')
                self.fields['can_delete'] = serializers.SerializerMethodField()
                self.fields['manager_stars'] = serializers.SerializerMethodField()
                self.fields['status'].write_only = True
                if 'stars' in self.context:
                    self.fields['is_curruser'] = serializers.SerializerMethodField()
            else:
                self.fields.pop('id')
                self.fields.pop('person')
                self.fields.pop('text')
                self.fields.pop('created')
                self.fields.pop('content_type')
                self.fields.pop('object_id')
            self.fields.pop('stars')
            self.fields.pop('comment_count')

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs['content_type'] == ContentType.objects.get(model='comment'):
            if attrs['content_object'].content_type != ContentType.objects.get(model='business'):
                raise serializers.ValidationError("Commeting on a non-review comment type currently isn't supported.")
            #elif self.context['request'].user == attrs['content_object'].content_object.manager:
            #    if 'status' not in attrs:
            #        raise serializers.ValidationError({'status': [getattr(Field, 'default_error_messages')['required']]})
        elif attrs['content_type'] == ContentType.objects.get(model='business'):
            if self.context['request'].user == attrs['content_object'].manager:
                raise serializers.ValidationError("You can't review your own business.")
            if models.Comment.objects.filter(content_type=ContentType.objects.get(model='business'), object_id=attrs['object_id'], person=self.context['request'].user).exists():
                raise serializers.ValidationError("Each business can be reviewed only once per person. Use PUT/DELETE for the existing review.")
        if 'status' in attrs and (attrs['content_type'] != ContentType.objects.get(model='comment') or self.context['request'].user != attrs['content_object'].content_object.manager):
            attrs.pop('status')
        return attrs

    """def create(self, validated_data):
        obj = models.Comment.objects.create(**validated_data)
        if obj.status is not None:
            obj.content_object.main_comment = obj
            obj.content_object.save()
        return obj"""

    def p_cont(self, obj, person, manager=None, stars=False, t=False):
        return super().p_cont(obj, person, manager if manager else obj.person, stars, t)

    def get_is_curruser(self, obj):
        return obj.person == self.context['request'].user

    def get_is_manager(self, obj):
        return obj.content_object.manager == self.context['request'].user

    def get_manager_stars(self, obj):
        if 'stars' in self.context:
            return self.p_cont(obj.content_object, obj.person, obj.content_object.business.manager, True)
        if obj.status is not None:
            return CommentSerializer(obj, likes=True, context=self.context).data
        return -1 if obj.person == (obj.content_object.content_object.manager if isinstance(obj.content_object, models.Comment) else obj.content_object.business.manager) else 0

    def get_can_delete(self, obj):
        return self.context['request'].user == obj.person or self.context['request'].user == (obj.content_object.content_object.manager if isinstance(obj.content_object, models.Comment) else obj.content_object.business.manager)

    def get_person(self, obj):
        if obj.is_liked:
            return UserSerializer(obj.person).data
        return None

    def get_distance(self, obj):
        return gen_distance(obj)

class LikeSerializer(CTSerializer, serializers.ModelSerializer):
    person = UserSerializer(default=CurrentUserDefault())

    class Meta:
        model = models.Like
        exclude = ('id', 'stars', 'is_dislike')
        extra_kwargs = {'object_id': {'write_only': True}}
        validators = [
            UniqueTogetherValidator(
                queryset=models.Like.objects.all(),
                fields=('person', 'content_type', 'object_id'),
                message="You already gave a (dis)like or rated this. Use PUT/PATCH."
            )
        ]

    def __init__(self, *args, **kwargs):
        kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        if 'showdate' not in self.context:
            self.fields.pop('date')
        if 'stars' in self.context:
            self.fields['stars'] = serializers.IntegerField(min_value=1, max_value=5, write_only='showtype' not in self.context)
        elif 'business' not in self.context:
            self.fields['is_dislike'] = serializers.NullBooleanField(write_only='showtype' not in self.context)

    def own_like_err(self, model):
        raise serializers.ValidationError("You can't %s your own %s." % ("give a (dis)like to" if not 'stars' in self.fields else "rate", model))

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs['content_type'] == ContentType.objects.get(model='comment'):
            if attrs['content_object'].content_type == ContentType.objects.get(model='comment'):
                if attrs['content_object'].status is None:
                    raise serializers.ValidationError("Liking an user comment currently isn't supported.")
            elif attrs['content_object'].person == self.context['request'].user:
                self.own_like_err('review')
        elif attrs['content_type'] == ContentType.objects.get(model='business'):
            if attrs['content_object'].manager == self.context['request'].user:
                raise serializers.ValidationError("You can't make your own business as favourite.")
        elif attrs['content_object'].business.manager == self.context['request'].user:
            self.own_like_err(attrs['content_type'].model)
        return attrs


class ReminderSerializer(CTSerializer, serializers.ModelSerializer):
    to_person = serializers.HiddenField(default=serializers.CurrentUserDefault())
    content_type = serializers.HiddenField(default=get_from_ct('event'))
    object_id = serializers.IntegerField()
    when = serializers.DateTimeField()

    class Meta:
        model = models.EventNotification
        exclude = ('from_person', 'comment_type', 'count')
        validators = [
            UniqueTogetherValidator(
                queryset=models.EventNotification.objects.all(),
                fields=('to_person', 'content_type', 'object_id', 'when'),
                message="Such reminder with the same date is already set."
            )
        ]

    def validate(self, attrs):
        attrs = chktime(super().validate(attrs), timedelta(minutes=1))
        if attrs['when'] > attrs['content_object'].when:
            raise serializers.ValidationError({'content_object': "The reminder date exceeds the event date, or the event is in the past."})
        return attrs
