from django.contrib.auth import update_session_auth_hash
from rest_framework import serializers
from .models import User, Location, CHOICE_GENDER


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = '__all__'


class UserSerializer(serializers.ModelSerializer):
    location = LocationSerializer(default=None)

    class Meta:
        model = User
        fields = '__all__'

    def create(self, validated_data):
        loc = Location.objects.create(**validated_data.pop('location'))
        pss = validated_data.pop('password')
        usr = User(location=loc, **validated_data)
        usr.set_password(pss)
        usr.save()

        return usr

    def update(self, instance, validated_data):
        instance.username = validated_data['username']
        instance.email = validated_data['email']
        instance.first_name = validated_data['first_name']
        instance.last_name = validated_data['last_name']
        instance.gender = validated_data['gender']
        instance.birth = validated_data['birth']
        loc_data = validated_data.pop('location')
        loc = instance.location
        loc.city = loc_data['city']
        loc.country = loc_data['country']
        loc.save()
        instance.set_password(validated_data['password'])
        instance.save()

        update_session_auth_hash(self.context.get('request'), instance)

        return instance
