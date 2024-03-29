from rest_framework import permissions
from .models import Event, Comment, Item, Business, Waiter
from django.conf import settings

def match_shortname(request, obj):
    obj = obj if isinstance(obj, Business) else obj.business if hasattr(obj, 'business') else None if not hasattr(obj, 'content_object') else obj.content_object.business if isinstance(obj.content_object, Business) else obj.content_object.content_object.business if isinstance(obj.content_object, Comment) else None
    return not obj or obj.shortname == request.session['table']['shortname']

class IsAuthenticated(permissions.IsAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) or hasattr(view, 'TABLE_SESSION_CHECK') and 'table' in request.session and (view.TABLE_SESSION_CHECK == True or request.method in permissions.SAFE_METHODS) \

    def has_object_permission(self, request, view, obj):
        return super().has_permission(request, view) or not hasattr(view, 'TABLE_SESSION_CHECK') or match_shortname(request, obj)

class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object to edit it.
    """

    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS or not settings.DEMO or view.__class__.__name__ == 'OrderAPIView' or request.user.is_staff

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request
        if request.method in permissions.SAFE_METHODS or request.user.is_anonymous and hasattr(obj, 'business') and obj.business.shortname == request.session['table']['shortname']:
            return True

        # Write permissions are only allowed to the owner of the snippet

        if settings.DEMO and view.__class__.__name__ != 'OrderAPIView' and not request.user.is_staff:
            return False
        if isinstance(obj, Event) or isinstance(obj, Item):
            user = obj.business.manager
        elif isinstance(obj, Waiter):
            user = obj.table.business.manager if obj.table else obj.business.manager
        else:
            user = getattr(obj, 'person', getattr(obj, 'user', getattr(obj, 'manager', obj)))

        if isinstance(obj, Comment) and user != request.user:
            return request.user == (obj.content_object.content_object.manager if isinstance(obj.content_object, Comment) else obj.content_object.business.manager)
        return user == request.user