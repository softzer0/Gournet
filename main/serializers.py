#from django.contrib.auth import update_session_auth_hash
from rest_framework import serializers
from allauth.account.models import EmailAddress
"""from django.contrib.auth import get_user_model

UserModel = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()"""

class EmailSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailAddress
        exclude = ('id', 'user',)
