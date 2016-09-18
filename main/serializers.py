#from django.contrib.auth import update_session_auth_hash
from django.utils import timezone
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

class BaseSerializer(serializers.ModelSerializer):
    business = BusinessSerializer(read_only=True, default=CurrentBusinessDefault())
    likestars_count = serializers.SerializerMethodField()
    dislike_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    curruser_status = serializers.SerializerMethodField()
    person_status = serializers.SerializerMethodField()

    def __init__(self, *args, **kwargs):
        if 'stars' in kwargs:
            self.stars = kwargs['stars']
            kwargs.pop('stars')
        else:
            self.stars = False
        kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        if not 'person' in self.context:
            self.fields.pop('person_status')
        if self.stars:
            self.fields['stars_avg'] = serializers.SerializerMethodField()
        #elif self.context['person_business'] == True:
        #    self.fields.pop('business')

    def validate(self, attrs):
        chkbusiness(attrs['business'])
        return attrs #, timedelta(minutes=1)

    def p_status(self, obj, t=None):
        if t:
            person = self.context['person']
        elif 'request' in self.context:
            person = self.context['request'].user
        else:
            return -1
        if obj.business.manager != person: #and person.is_authenticated()
            try:
                ls = Like.objects.get(content_type__pk=ContentType.objects.get_for_model(obj).pk, object_id=obj.pk, person=person)
            except:
                return 0
            else:
                if not self.stars:
                    return 2 if ls.is_dislike else 1
                else:
                    return ls.stars
        return -1

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


def exists(attrs):
    try:
        attrs['content_object'] = attrs['content_type'].model_class().objects.get(pk=attrs['object_id'])
    except:
        raise serializers.ValidationError({'object_id': [getattr(PrimaryKeyRelatedField, 'default_error_messages')['does_not_exist'].format(pk_value=attrs['object_id'])]})
    return attrs

class LikeSerializer(serializers.ModelSerializer):
    person = UserSerializer(read_only=True, default=serializers.CurrentUserDefault())
    content_type = serializers.PrimaryKeyRelatedField(queryset=ContentType.objects.filter(pk__in=CONTENT_TYPES_PK), write_only=True)
    is_dislike = serializers.NullBooleanField()

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

    def validate(self, attrs):
        attrs = exists(attrs)
        if attrs['content_object'].business.manager == self.context['request'].user:
            raise serializers.ValidationError({'non_field_errors': ["You can't %s your own %s." % ("give a (dis)like to" if not 'stars' in self.fields else "rate", attrs['content_type'].model)]})
        return attrs


class CommentSerializer(serializers.ModelSerializer):
    person = UserSerializer(read_only=True, default=serializers.CurrentUserDefault())
    content_type = serializers.PrimaryKeyRelatedField(queryset=ContentType.objects.filter(pk__in=CONTENT_TYPES_PK), write_only=True)
    is_curruser = serializers.SerializerMethodField()
    manager_stars = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        extra_kwargs = {
            'created': {'read_only': True},
            'object_id': {'write_only': True}
        }

    def __init__(self, *args, **kwargs):
        kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        if 'curruser' in self.context:
            self.fields.pop('person')
            self.fields.pop('is_curruser')
            self.fields['content_type'].write_only = False
            self.fields['content_object'] = GenericRelatedField({
                Event: EventSerializer(),
                Item: ItemSerializer(),
                #Review: ReviewSerializer()
            }, read_only=True)

    def validate(self, attrs):
        return exists(attrs)

    def get_is_curruser(self, obj):
        return obj.person == self.context['request'].user

    def get_manager_stars(self, obj):
        if 'stars' in self.context:
            if obj.person != obj.content_object.business.manager:
                try:
                    return Like.objects.get(content_type=obj.content_type, object_id=obj.object_id, person=obj.person).stars
                except:
                    return 0
            else:
                return -1
        else:
            return obj.person == obj.content_object.business.manager