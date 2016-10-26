#from django.contrib.auth import update_session_auth_hash
#from rest_framework.fields import Field
from django.utils import timezone
from django.core.validators import MinLengthValidator
from datetime import timedelta
from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator
from rest_framework.relations import PrimaryKeyRelatedField
from allauth.account.models import EmailAddress
from .models import Relationship, Notification, Business, Event, Comment, Like, EventNotification, Item, CONTENT_TYPES_PK
from django.contrib.auth import get_user_model
from rest_framework.compat import unicode_to_repr
from generic_relations.relations import GenericRelatedField
from django.contrib.contenttypes.models import ContentType
from django.db.models import Avg
from django.conf import settings
import os.path
from django.db.models import Case, When, Value, IntegerField

User = get_user_model()
NOT_MANAGER_MSG = "You're not a manager of any business."

APP_LABEL = os.path.basename(os.path.dirname(__file__))
def gen_where(model, pk, table=None, additional_obj=None, column=None, target=None, ct=None): #, col_add=None
    #if not col_add:
    col_add = 'person_' if model != 'user' and target == 'relationship' else 'from_person_' if model == 'relationship' else ''
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

def sort_related(query, first=None, where=None, retothers=False):
    """
    @type query: django.db.models.QuerySet
    """
    others = query.extra(where=[where if where else gen_where(query.model.__name__.lower(), first, target='relationship')])
    if retothers:
        return others
    if first:
        cases = [When(pk=first, then=Value(0))]
        s = 1
    else:
        cases = []
        s = 0
    cases += [When(pk=obj.pk, then=Value(i+s)) for i, obj in enumerate(others.all())]
    return query.annotate(rel_objs=Case(*cases, output_field=IntegerField())).order_by('rel_objs', *query.model._meta.ordering)

class UsersWithoutCurrentField(serializers.PrimaryKeyRelatedField):
    def get_queryset(self):
        qs = User.objects.all()
        if 'request' in self.context: #and self.context['request'].user.is_authenticated():
            qs = qs.exclude(pk=self.context['request'].user.pk)
        return qs

class RelationshipSerializer(serializers.ModelSerializer):
    to_person = UsersWithoutCurrentField()
    from_person = serializers.PrimaryKeyRelatedField(read_only=True, default=serializers.CurrentUserDefault())

    class Meta:
        model = Relationship
        exclude = ('notification',) #extra_kwargs = {
        #    'notification': {'read_only': True},
        #}
        validators = [
            UniqueTogetherValidator(
                queryset=Relationship.objects.all(),
                fields=('from_person', 'to_person'),
                message="Such relationship already exists."
            )
        ]


class EmailSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailAddress
        exclude = ('id', 'user')


class NotificationSerializer(serializers.ModelSerializer):
    read_only = True

    class Meta:
        model = Notification
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

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'first_name', 'last_name')

    def __init__(self, *args, **kwargs):
        kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        self.read_only = True
        if 'list' in self.context:
            self.fields['rel_state'] = serializers.SerializerMethodField()
            self.fields['friend_count'] = serializers.SerializerMethodField()

    def get_friend_count(self, obj):
        friends = User.objects.filter(from_person__to_person=obj).extra(where=[gen_where('relationship', obj.pk, 'relationship', target='user', column='id')])
        return [friends.count(), sort_related(friends, self.context['request'].user.pk, retothers=True).count()]

    def get_rel_state(self, obj):
        if self.context['request'].user != obj:
            r = 0
            if Relationship.objects.filter(from_person=self.context['request'].user, to_person=obj).exists():
                r = 1
            if Relationship.objects.filter(from_person=obj, to_person=self.context['request'].user).exists():
                r += 2
            return r
        return -1


class BusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        #exclude = ('manager', 'type', 'phone')
        fields = ('id', 'shortname', 'name') #, business
        extra_kwargs = {
            'shortname': {'read_only': True},
            'name': {'read_only': True}
        }

    def __init__(self, *args, **kwargs):
        currency = extarg(kwargs, 'currency')
        kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        self.read_only = True
        if 'list' in self.context or currency:
            self.fields['currency'] = serializers.CharField() #, source='get_currency_display'
            if not currency:
                self.fields['supported_curr'] = serializers.SerializerMethodField()
                self.fields['is_opened'] = serializers.SerializerMethodField()
                self.fields['item_count'] = serializers.IntegerField(source='item_set.count')
                self.fields['curruser_status'] = serializers.SerializerMethodField()
                self.fields['likestars_count'] = serializers.IntegerField(source='likes.count')
        if 'notype' not in self.context:
            self.fields['type_display'] = serializers.CharField(source='get_type_display')

    def get_is_opened(self, obj):
        day = timezone.now().weekday()
        opened = obj.opened_sat if day == 5 and obj.opened_sat else obj.opened_sun if day == 6 and obj.opened_sun else obj.opened
        closed = obj.closed_sat if day == 5 and obj.closed_sat else obj.closed_sun if day == 6 and obj.closed_sun else obj.closed
        return opened <= timezone.now().time() < closed

    def get_supported_curr(self, obj):
        return obj.supported_curr.values_list('name', flat=True)

    def get_curruser_status(self, obj):
        return -1 if self.context['request'].user == obj.manager else 1 if obj.likes.filter(person=self.context['request'].user).exists() else 0

class CurrentBusinessDefault(object):
    def set_context(self, serializer_field):
        if isinstance(serializer_field, serializers.Serializer):
            sf = serializer_field.parent
        else:
            sf = serializer_field
        try:
            self.business = Business.objects.get(manager=sf.context['request'].user)
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

def chkbusiness(business):
    if not business:
        raise serializers.ValidationError({'non_field_errors': [NOT_MANAGER_MSG]})

class BaseSerializer(serializers.ModelSerializer):
    likestars_count = serializers.SerializerMethodField()
    dislike_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    curruser_status = serializers.SerializerMethodField()

    def __init__(self, *args, **kwargs):
        extarg(kwargs, 'stars', self)
        kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        if 'person' in self.context:
            self.fields['person_status'] = serializers.SerializerMethodField()
        if self.stars:
            self.fields['stars_avg'] = serializers.SerializerMethodField()
        #elif self.context['person_business'] == True:
        #    self.fields.pop('business')

    def validate(self, attrs):
        chkbusiness(attrs['business'])
        return attrs #, timedelta(minutes=1)

    def p_cont(self, obj, person, manager=None, stars=False, t=False):
        if (manager if manager else obj.business.manager) != person:
            try:
                ls = Like.objects.get(content_type__pk=ContentType.objects.get_for_model(obj).pk, object_id=obj.pk, person=person)
            except:
                return 0
            if not self.stars and not stars:
                return [2 if ls.is_dislike else 1, ls.date] if t else 2 if ls.is_dislike else 1
            return [ls.stars, ls.date] if t else ls.stars
        if t:
            if not isinstance(obj, Comment) and 'person' in self.context and self.context['person'] == self.context['request'].user:
                return [-1, obj.created]
            return [-1]
        return -1

    def p_status(self, obj, t=False):
        if t:
            person = self.context['person']
        elif 'request' in self.context: #and self.context['request'].user.is_authenticated()
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
            return Like.objects.filter(content_type__pk=ContentType.objects.get_for_model(obj).pk, object_id=obj.pk, is_dislike=False).count()
        return Like.objects.filter(content_type__pk=ContentType.objects.get_for_model(obj).pk, object_id=obj.pk).count()

    def get_stars_avg(self, obj):
        avg = Like.objects.filter(content_type__pk=ContentType.objects.get_for_model(obj).pk, object_id=obj.pk).aggregate(Avg('stars'))['stars__avg']
        return avg if avg else 0

    def get_dislike_count(self, obj):
        return Like.objects.filter(content_type__pk=ContentType.objects.get_for_model(obj).pk, object_id=obj.pk, is_dislike=True).count()

    def get_comment_count(self, obj):
        return Comment.objects.filter(content_type__pk=ContentType.objects.get_for_model(obj).pk, object_id=obj.pk).count()

REVIEW_MIN_CHAR = 6

class CommentSerializer(BaseSerializer):
    person = UserSerializer(default=CurrentUserDefault())
    content_type = serializers.PrimaryKeyRelatedField(queryset=ContentType.objects.filter(pk__in=CONTENT_TYPES_PK), write_only=True)

    class Meta:
        model = Comment
        exclude = ('main_comment',)
        extra_kwargs = {
            'created': {'read_only': True},
            'object_id': {'write_only': True}
        }

    def __init__(self, *args, **kwargs):
        likes = extarg(kwargs, 'likes')
        kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        if not self.read_only and not likes and ('person' in self.context or 'curruser' in self.context or 'business' in self.context or 'ids' in self.context):
            context = self.context.copy()
            if 'business' not in self.context:
                self.fields['content_object'] = GenericRelatedField({Business: BusinessSerializer()}, read_only=True)
                if 'ids' not in self.context:
                    self.fields.pop('person')
                    context.pop('person', False)
            self.fields['main_comment'] = CommentSerializer(read_only=True, context=context)
            self.fields.pop('status')
            self.fields['text'].validators = [MinLengthValidator(REVIEW_MIN_CHAR)]
            self.fields['is_manager'] = serializers.SerializerMethodField()
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
        attrs = exists(attrs)
        if attrs['content_type'].model == 'comment':
            if attrs['content_object'].content_type.model != 'business':
                raise serializers.ValidationError({'non_field_errors': ["Commeting on a non-review comment type currently isn't supported."]})
            #elif self.context['request'].user == attrs['content_object'].content_object.manager:
            #    if 'status' not in attrs:
            #        raise serializers.ValidationError({'status': [getattr(Field, 'default_error_messages')['required']]})
        elif attrs['content_type'].model == 'business':
            if self.context['request'].user == attrs['content_object'].manager:
                raise serializers.ValidationError({'non_field_errors': ["You can't review your own business."]})
            if Comment.objects.filter(content_type=settings.CONTENT_TYPES['business'], object_id=attrs['object_id'], person=self.context['request'].user).exists():
                raise serializers.ValidationError({'non_field_errors': ["A business per person can be reviewed only once. Use PUT/DELETE for the existing review."]})
        if 'status' in attrs and (attrs['content_type'].model != 'comment' or self.context['request'].user != attrs['content_object'].content_object.manager):
            attrs.pop('status')
        return attrs

    """def create(self, validated_data):
        obj = Comment.objects.create(**validated_data)
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
        return -1 if obj.person == (obj.content_object.content_object.manager if isinstance(obj.content_object, Comment) else obj.content_object.business.manager) else 0

    def get_can_delete(self, obj):
        return self.context['request'].user == obj.person or self.context['request'].user == (obj.content_object.content_object.manager if isinstance(obj.content_object, Comment) else obj.content_object.business.manager)

class EventSerializer(BaseSerializer):
    class Meta:
        model = Event
        exclude = ('business',)

    def __init__(self, *args, **kwargs):
        kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        self.fields.pop('created')
        if 'hiddenbusiness' in self.context:
            self.fields['business'] = serializers.HiddenField(default=CurrentBusinessDefault())
        else:
            self.fields['business'] = BusinessSerializer(default=CurrentBusinessDefault())

    def validate(self, attrs):
        return chktime(super().validate(attrs)) #, timedelta(minutes=1)

class ItemSerializer(BaseSerializer):
    class Meta:
        model = Item
        exclude = ('business',)
        validators = [
            UniqueTogetherValidator(
                queryset=Item.objects.all(),
                fields=('business', 'name'),
                message="An item with the same name already exists."
            )
        ]

    def __init__(self, *args, **kwargs):
        kwargs['stars'] = True
        kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        self.fields.pop('created')
        self.fields.pop('dislike_count')
        if 'hiddenbusiness' in self.context:
            self.fields['business'] = serializers.HiddenField(default=CurrentBusinessDefault())
        else:
            self.fields['business'] = BusinessSerializer(default=CurrentBusinessDefault(), currency=True)
        if 'menu' in self.context:
            self.fields.pop('curruser_status')
            self.fields.pop('likestars_count')
            self.fields.pop('comment_count')
            #self.fields.pop('stars_avg')
        else:
            if 'ids' not in self.context:
                self.fields['category'].write_only = True
            if 'hiddenbusiness' in self.context:
                self.fields['currency'] = serializers.CharField(source='business.currency', read_only=True)
            self.fields['category_display'] = serializers.CharField(source='get_category_display', read_only=True)


def exists(attrs):
    try:
        attrs['content_object'] = attrs['content_type'].model_class().objects.get(pk=attrs['object_id'])
    except:
        raise serializers.ValidationError({'object_id': [getattr(PrimaryKeyRelatedField, 'default_error_messages')['does_not_exist'].format(pk_value=attrs['object_id'])]})
    return attrs

class LikeSerializer(serializers.ModelSerializer):
    person = UserSerializer(default=CurrentUserDefault())
    content_type = serializers.PrimaryKeyRelatedField(queryset=ContentType.objects.filter(pk__in=CONTENT_TYPES_PK), write_only=True)

    class Meta:
        model = Like
        exclude = ('id', 'is_dislike')
        extra_kwargs = {'object_id': {'write_only': True}}
        validators = [
            UniqueTogetherValidator(
                queryset=Like.objects.all(),
                fields=('person', 'content_type', 'object_id'),
                message="You already gave a (dis)like or rated this. Use PUT/PATCH."
            )
        ]

    def __init__(self, *args, **kwargs):
        kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        if 'stars' in self.context:
            self.fields['stars'] = serializers.IntegerField(min_value=1, max_value=5)
        else:
            self.fields.pop('stars')
            if 'business' not in self.context:
                self.fields['is_dislike'] = serializers.NullBooleanField()

    def validate(self, attrs):
        attrs = exists(attrs)
        if attrs['content_type'].model == 'comment':
            if attrs['content_object'].content_type == settings.CONTENT_TYPES['comment'] and attrs['content_object'].status is None:
                raise serializers.ValidationError({'non_field_errors': ["Liking an user comment currently isn't supported."]})
        elif attrs['content_type'].model == 'business':
            if attrs['content_object'].manager == self.context['request'].user:
                raise serializers.ValidationError({'non_field_errors': ["You can't make your own business as favourite."]})
        elif attrs['content_object'].business.manager == self.context['request'].user:
            raise serializers.ValidationError({'non_field_errors': ["You can't %s your own %s." % ("give a (dis)like to" if not 'stars' in self.fields else "rate", attrs['content_type'].model)]})
        return attrs


class ReminderSerializer(serializers.ModelSerializer):
    to_person = serializers.HiddenField(default=serializers.CurrentUserDefault())
    content_type = serializers.HiddenField(default=settings.CONTENT_TYPES['event'])

    class Meta:
        model = EventNotification
        exclude = ('from_person', 'comment_type')
        validators = [
            UniqueTogetherValidator(
                queryset=EventNotification.objects.all(),
                fields=('to_person', 'content_type', 'object_id', 'when'),
                message="Such reminder with the same date is already set."
            )
        ]

    def validate(self, attrs):
        attrs = chktime(exists(attrs), timedelta(minutes=1))
        if attrs['when'] > attrs['content_object'].when:
            raise serializers.ValidationError({'content_object': "The reminder date exceeds the event date, or the event is in the past."})
        return attrs