#from django.contrib.auth import update_session_auth_hash
from rest_framework import serializers
from allauth.account.models import EmailAddress
from .models import Relationship
"""from django.contrib.auth import get_user_model

UserModel = get_user_model()"""

class RelationshipSerializer(serializers.ModelSerializer):
    class Meta:
        model = Relationship
        exclude = ('person2',)

    def create(self, validated_data):
        validated_data['person2'] = validated_data['person1']
        validated_data['person1'] = self.context['request'].user
        return super().create(validated_data)

    def validate(self, attrs):
        user = self.context['request'].user
        person = attrs.get('person1')
        if user == person:
            raise serializers.ValidationError("You can't make a relationship with yourself.")
        if Relationship.objects.filter(person1=user, person2=person).exists():
            raise serializers.ValidationError("Relationship with "+person.username+" already exists.")
        return attrs


"""class UserSerializer(serializers.ModelSerializer):
    friends = RelationshipSerializer(many=True)

    class Meta:
        model = get_user_model()"""

class EmailSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailAddress
        exclude = ('id', 'user',)
