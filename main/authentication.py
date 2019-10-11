from rest_framework_simplejwt.authentication import JWTAuthentication as DefJWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed
from rest_framework.authentication import SessionAuthentication as DefSessionAuthentication

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

class SessionAuthentication(DefSessionAuthentication):
    def authenticate(self, request):
        """
        Returns a `User` if the request session currently has a logged in user.
        Otherwise returns `None`.
        """

        # Get the session-based user from the underlying HttpRequest object
        user = getattr(request._request, 'user', None)

        # Unauthenticated, CSRF validation not required
        if 'table' not in request.session and (not user or not user.is_active):
            return None

        self.enforce_csrf(request)

        # CSRF passed with authenticated user
        return (user, None)