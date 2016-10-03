#from django.contrib.auth import update_session_auth_hash
#from rest_framework.fields import Field
from django.utils import timezone
from django.core.validators import MinLengthValidator
from datetime import timedelta
from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator
from rest_framework.relations import PrimaryKeyRelatedField
from allauth.account.models import EmailAddress
from .models import Relationship, Notification, Business, Event, Comment, Like, Reminder, Item, CONTENT_TYPES_PK
from django.contrib.auth import get_user_model
from rest_framework.compat import unicode_to_repr
from generic_relations.relations import GenericRelatedField
from django.contrib.contenttypes.models import ContentType
from django.db.models import Avg
from django.conf import settings

User = get_user_model()
NOT_MANAGER_MSG = "You're not a manager of any business."

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


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'first_name', 'last_name')


class EmailSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailAddress
        exclude = ('id', 'user')


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        exclude = ('user',)
        extra_kwargs = {
            'link': {'read_only': True},
            'text': {'read_only': True},
            'created': {'read_only': True}
        }


class BusinessSerializer(serializers.ModelSerializer):
    business = serializers.PrimaryKeyRelatedField(queryset=Business.objects.all(), write_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)

    class Meta:
        model = Business
        fields = ('business', 'id', 'shortname', 'name', 'type_display')
        extra_kwargs = {
            'shortname': {'read_only': True},
            'name': {'read_only': True}
        }

    def __init__(self, *args, **kwargs):
        # Don't pass the 'fields' arg up to the superclass
        kwargs.pop('fields', None)

        if kwargs.get('currency', False):
            self.fields['currency'] = serializers.CharField(read_only=True) #, source='get_currency_display'
            kwargs.pop('currency')

        # Instantiate the superclass normally
        super().__init__(*args, **kwargs)

        if 'notype' in self.context:
            self.fields.pop('type_display')

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

class BaseSerializer(serializers.ModelSerializer):
    business = BusinessSerializer(read_only=True, default=CurrentBusinessDefault())
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

    def p_cont(self, obj, person, manager=None, stars=False):
        if (manager if manager else obj.business.manager) != person:
            try:
                ls = Like.objects.get(content_type__pk=ContentType.objects.get_for_model(obj).pk, object_id=obj.pk, person=person)
            except:
                return 0
            if not self.stars and not stars:
                return 2 if ls.is_dislike else 1
            return ls.stars
        return -1

    def p_status(self, obj, t=None):
        if t:
            person = self.context['person']
        elif 'request' in self.context: #and self.context['request'].user.is_authenticated()
            person = self.context['request'].user
        else:
            return -1
        return self.p_cont(obj, person)

    def get_curruser_status(self, obj):
        return self.p_status(obj)

    def get_person_status(self, obj):
        return self.p_status(obj, True)

    def get_likestars_count(self, obj):
        if not self.stars:
            return Like.objects.filter(content_type__pk=ContentType.objects.get_for_model(obj).pk, object_id=obj.pk, is_dislike=False).count()
        else:
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
    person = UserSerializer(read_only=True, default=serializers.CurrentUserDefault())
    content_type = serializers.PrimaryKeyRelatedField(queryset=ContentType.objects.filter(pk__in=CONTENT_TYPES_PK), write_only=True)

    class Meta:
        model = Comment
        extra_kwargs = {
            'created': {'read_only': True},
            'object_id': {'write_only': True}
        }

    def __init__(self, *args, **kwargs):
        likes = extarg(kwargs, 'likes')
        kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        self.fields.pop('business')
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
            self.fields.pop('main_comment')

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

    def p_cont(self, obj, person, manager=None, stars=False):
        return super().p_cont(obj, person, manager if manager else obj.person, stars)

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

    def validate(self, attrs):
        return chktime(super().validate(attrs)) #, timedelta(minutes=1)

class ItemSerializer(BaseSerializer):
    class Meta:
        model = Item
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
        if 'hiddenbusiness' in self.context or 'menu' in self.context:
            self.fields['business'] = serializers.HiddenField(default=CurrentBusinessDefault())
        else:
            self.fields['business'] = BusinessSerializer(read_only=True, default=CurrentBusinessDefault(), currency=True)
        if 'menu' in self.context:
            self.fields.pop('curruser_status')
            self.fields.pop('likestars_count')
            self.fields.pop('dislike_count')
            self.fields.pop('comment_count')
            #self.fields.pop('stars_avg')
        else:
            self.fields['category'].write_only = True
            self.fields['category_display'] = serializers.CharField(source='get_category_display', read_only=True)


def exists(attrs):
    try:
        attrs['content_object'] = attrs['content_type'].model_class().objects.get(pk=attrs['object_id'])
    except:
        raise serializers.ValidationError({'object_id': [getattr(PrimaryKeyRelatedField, 'default_error_messages')['does_not_exist'].format(pk_value=attrs['object_id'])]})
    return attrs

class LikeSerializer(serializers.ModelSerializer):
    person = UserSerializer(read_only=True, default=serializers.CurrentUserDefault())
    content_type = serializers.PrimaryKeyRelatedField(queryset=ContentType.objects.filter(pk__in=CONTENT_TYPES_PK), write_only=True)

    class Meta:
        model = Like
        exclude = ('id',)
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
            self.fields.pop('is_dislike')
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
                raise serializers.ValidationError({'non_field_errors': ["You can't make as favourite your own business."]})
        elif attrs['content_object'].business.manager == self.context['request'].user:
            raise serializers.ValidationError({'non_field_errors': ["You can't %s your own %s." % ("give a (dis)like to" if not 'stars' in self.fields else "rate", attrs['content_type'].model)]})
        return attrs


class ReminderSerializer(serializers.ModelSerializer):
    person = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Reminder
        validators = [
            UniqueTogetherValidator(
                queryset=Reminder.objects.all(),
                fields=('person', 'event', 'when'),
                message="Such reminder with the same date is already set."
            )
        ]

    def validate(self, attrs):
        attrs = chktime(attrs, timedelta(minutes=1))
        if attrs['when'] > attrs['event'].when:
            raise serializers.ValidationError({'event': "The reminder date exceeds the event date, or the event is in the past."})
        return attrs