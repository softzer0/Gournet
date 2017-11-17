from rest_framework_simplejwt.authentication import JWTAuthentication as DefJWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed

class JWTAuthentication(DefJWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        try:
            pass_last_changed = validated_token['pw_l_c']
        except:
            raise InvalidToken("Token contained no recognizable user identification")
        if user.pass_last_changed != pass_last_changed:
            raise AuthenticationFailed("Users must re-authenticate after changing password", code='must_reauthenticate')
        return user