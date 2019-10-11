from rest_framework import permissions
from .models import Event, Comment, Item

class IsAuthenticated(permissions.IsAuthenticated):
    def has_permission(self, request, view):
        return hasattr(view, 'TABLE_SESSION_CHECK') and 'table' in request.session and (view.TABLE_SESSION_CHECK == True or request.method in permissions.SAFE_METHODS) or super().has_permission(request, view)

class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object to edit it.
    """

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request
        if 'table' in request.session or request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions are only allowed to the owner of the snippet

        if isinstance(obj, Event) or isinstance(obj, Item):
            user = obj.business.manager
        else:
            user = getattr(obj, 'person', getattr(obj, 'user', getattr(obj, 'manager', obj)))

        if isinstance(obj, Comment) and user != request.user:
            return request.user == (obj.content_object.content_object.manager if isinstance(obj.content_object, Comment) else obj.content_object.business.manager)
        return user == request.user