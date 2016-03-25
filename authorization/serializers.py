from django.contrib.auth import update_session_auth_hash
from rest_framework import serializers
from .models import Users, Location, CHOICE_GENDER

class LocationSerializer(serializers.ModelSerializer):
    city = serializers.CharField(max_length=75, default=None)
    country = serializers.CharField(max_length=25, default=None)

    class Meta:
        model = Location
        fields = ('city', 'country')

class UserSerializer(serializers.ModelSerializer):
    email = serializers.CharField(write_only=True, required=False)
    first_name = serializers.CharField(default=None)
    last_name = serializers.CharField(default=None)
    gender = serializers.ChoiceField(choices=CHOICE_GENDER, default=None)
    birth = serializers.DateField(default=None)
    location = LocationSerializer(default=None)
    password = serializers.CharField(write_only=True, default=None)

    class Meta:
        model = Users
        fields = ('username', 'email', 'first_name', 'last_name', 'gender', 'birth', 'location', 'password')

    def create(self, validated_data):
        loc = Location.objects.create(**validated_data.pop('location'))
        return  Users.objects.create(location=loc, **validated_data)

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

        return instance
