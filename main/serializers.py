#from django.contrib.auth import update_session_auth_hash
from django.utils import timezone
from datetime import timedelta
from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator
from allauth.account.models import EmailAddress
from .models import Relationship, Notification, Business, Event, Comment, Like, Reminder, Item
from django.contrib.auth import get_user_model
from rest_framework.compat import unicode_to_repr

User = get_user_model()

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

        # Instantiate the superclass normally
        super().__init__(*args, **kwargs)

        if 'notype' in self.context:
            self.fields.pop('type_display')


class PrimaryKeyInObjectOutRelatedField(serializers.PrimaryKeyRelatedField):
    """
    Django Rest Framework RelatedField which takes the primary key as input to allow setting relations,
    but takes an optional `output_serializer_class` parameter, which if specified, will be used to
    serialize the data in responses.

    Usage:
        class MyModelSerializer(serializers.ModelSerializer):
            related_model = PrimaryKeyInObjectOutRelatedField(
                queryset=MyOtherModel.objects.all(), output_serializer_class=MyOtherModelSerializer)

            class Meta:
                model = MyModel
                fields = ('related_model', 'id', 'foo', 'bar')
    """

    def __init__(self, **kwargs):
        if not hasattr(self, 'output_serializer_class'):
            self.output_serializer_class = kwargs.pop('output_serializer_class', None)
        if hasattr(self, 'write_only'):
            kwargs['write_only'] = self.write_only
        super().__init__(**kwargs)

    def use_pk_only_optimization(self):
        return not bool(self.output_serializer_class)

    def to_representation(self, obj):
        if self.output_serializer_class:
            # noinspection PyCallingNonCallable
            data = self.output_serializer_class(obj).data
        else:
            data = super().to_representation(obj)
        return data

class BusinessOfCurrentUserField(PrimaryKeyInObjectOutRelatedField):
    output_serializer_class = BusinessSerializer

    def __init__(self, **kwargs):
        kwargs['read_only'] = True
        super().__init__(**kwargs)

    def get_queryset(self):
        qs = Business.objects.all()
        if 'request' in self.context: #and self.context['request'].user.is_authenticated()
            qs = qs.filter(manager=self.context['request'].user)
        return qs

def chktime(attrs, td=timedelta()):
    if attrs['when'] < timezone.now()+td:
        attrs['when'] = timezone.now()+td
    return attrs

class EventSerializer(serializers.ModelSerializer):
    business = BusinessOfCurrentUserField()
    like_count = serializers.SerializerMethodField()
    dislike_count = serializers.SerializerMethodField()
    curruser_status = serializers.SerializerMethodField()
    person_status = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()

    class Meta:
        model = Event

    def __init__(self, *args, **kwargs):
        kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        if not 'person' in self.context:
            self.fields.pop('person_status')
        #elif self.context['person_business'] == True:
        #    self.fields.pop('business')

    def validate(self, attrs):
        return chktime(attrs) #, timedelta(minutes=1)

    def p_status(self, obj, t=None):
        if t:
            person = self.context['person']
        elif 'request' in self.context:
            person = self.context['request'].user
        else:
            return -1
        if obj.business.manager != person: #and person.is_authenticated()
            try:
                is_dislike = Like.objects.get(event=obj, person=person).is_dislike
            except:
                return 0
            else:
                return 2 if is_dislike else 1
        return -1

    def get_curruser_status(self, obj):
        return self.p_status(obj)

    def get_person_status(self, obj):
        return self.p_status(obj, True)

    def get_like_count(self, obj):
        return Like.objects.filter(event=obj, is_dislike=False).count()

    def get_dislike_count(self, obj):
        return Like.objects.filter(event=obj, is_dislike=True).count()

    def get_comment_count(self, obj):
        return Comment.objects.filter(event=obj).count()

class EventsWithoutCurrentUsersField(serializers.PrimaryKeyRelatedField):
    def get_queryset(self):
        qs = Event.objects.all()
        if 'request' in self.context: #and self.context['request'].user.is_authenticated()
            qs = qs.exclude(business__manager=self.context['request'].user)
        return qs

class LikeSerializer(serializers.ModelSerializer):
    event = EventsWithoutCurrentUsersField(write_only=True)
    person = UserSerializer(read_only=True, default=serializers.CurrentUserDefault())

    class Meta:
        model = Like
        exclude = ('id',)
        validators = [
            UniqueTogetherValidator(
                queryset=Like.objects.all(),
                fields=('person', 'event'),
                message="You already gave (dis)like. Use PUT/PATCH."
            )
        ]

class ReminderSerializer(serializers.ModelSerializer):
    person = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Reminder
        validators = [
            UniqueTogetherValidator(
                queryset=Reminder.objects.all(),
                fields=('person', 'event', 'when'),
                message="You already set such reminder with the same date."
            )
        ]

    def validate(self, attrs):
        return chktime(attrs, timedelta(minutes=1))


class CommentSerializer(serializers.ModelSerializer):
    person = UserSerializer(read_only=True, default=serializers.CurrentUserDefault())
    event = PrimaryKeyInObjectOutRelatedField(queryset=Event.objects.all(), output_serializer_class=EventSerializer, write_only=True)
    is_curruser = serializers.SerializerMethodField()
    is_manager = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        extra_kwargs = {'created': {'read_only': True}}

    def get_is_curruser(self, obj):
        return obj.person == self.context['request'].user

    def get_is_manager(self, obj):
        return obj.person == obj.event.business.manager

    def __init__(self, *args, **kwargs):
        kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        if 'curruser' in self.context:
            self.fields.pop('person')
            self.fields.pop('is_curruser')
            self.fields['event'].write_only = False


class CurrentBusinessDefault(object):
    def set_context(self, serializer_field):
        try:
            self.business = Business.objects.get(manager=serializer_field.context['request'].user)
        except:
            self.business = Business.objects.none()

    def __call__(self):
        return self.business

    def __repr__(self):
        return unicode_to_repr('%s()' % self.__class__.__name__)

class ItemSerializer(serializers.ModelSerializer):
    business = serializers.HiddenField(default=CurrentBusinessDefault())

    class Meta:
        model = Item
        validators = [
            UniqueTogetherValidator(
                queryset=Item.objects.all(),
                fields=('business', 'name'),
                message="An item with the same name already exists."
            )
        ]