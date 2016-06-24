from rest_framework import permissions
from .models import Event


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object to edit it.
    """

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions are only allowed to the owner of the snippet

        if isinstance(obj, Event):
            user = obj.business.manager
        else:
            user = obj.person

        return user == request.user