#from django.contrib.auth import update_session_auth_hash
from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator
from allauth.account.models import EmailAddress
from .models import Relationship, Notification, Business, Event, Comment, Like
from django.contrib.auth import get_user_model

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
    #type_display = serializers.CharField(source='get_type_display', read_only=True)

    class Meta:
        model = Business
        fields = ('business', 'id', 'shortname', 'name') #, 'type_display'
        extra_kwargs = {
            'shortname': {'read_only': True},
            'name': {'read_only': True}
        }


class BusinessesOfCurrentUserField(serializers.PrimaryKeyRelatedField):
    def get_queryset(self):
        qs = Business.objects.all()
        if 'request' in self.context: #and self.context['request'].user.is_authenticated()
            qs = qs.filter(manager=self.context['request'].user)
        return qs

class EventSerializer(serializers.ModelSerializer):
    business = BusinessesOfCurrentUserField()
    like_count = serializers.SerializerMethodField()
    dislike_count = serializers.SerializerMethodField()
    curruser_status = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()

    class Meta:
        model = Event

    def get_curruser_status(self, obj):
        if 'request' in self.context and obj.business.manager != self.context['request'].user: #and self.context['request'].user.is_authenticated()
            try:
                is_dislike = Like.objects.get(event=obj, person=self.context['request'].user).is_dislike
            except:
                return 0
            else:
                return 2 if is_dislike else 1
        return -1

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
                message="You already gave (dis)like."
            )
        ]
