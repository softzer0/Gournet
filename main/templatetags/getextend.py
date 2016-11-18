from django.template.defaulttags import register

@register.filter
def get_item(dictionary, key):
    return dictionary.get(key, False)

@register.filter
def get_attr(obj, attr):
    return getattr(obj, attr)

@register.filter
def r_i(value, i):
    return value.format(i=i)