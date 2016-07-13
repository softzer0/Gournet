from django import template
from django.conf import settings
from django.utils.safestring import mark_safe
from django.contrib.staticfiles.finders import find
from django.contrib.staticfiles.storage import staticfiles_storage

register = template.Library()


def checkstatic(path):
    if settings.DEBUG:
        return find(path)
    else:
        return staticfiles_storage.exists(path)

def loadstatic(path, mode='r'):
    absolute_path = checkstatic(path)
    if absolute_path:
        if settings.DEBUG:
            return open(absolute_path, mode).read()
        else:
            return staticfiles_storage.open(path).read()


@register.simple_tag
def raw_include(path):
    content = loadstatic(path)
    return mark_safe(content)