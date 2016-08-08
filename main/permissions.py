from rest_framework import permissions
from .models import Event, Comment, Item


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object to edit it.
    """

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions are only allowed to the owner of the snippet

        if isinstance(obj, Event) or isinstance(obj, Item):
            user = obj.business.manager
        else:
            user = obj.person

        if isinstance(obj, Comment) and user != request.user:
            return obj.event.business.manager == request.user
        return user == request.user