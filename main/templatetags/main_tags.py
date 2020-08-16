from django.template.defaulttags import register
from django.template import Node, TemplateSyntaxError
from django.utils.safestring import mark_safe
from django.utils.encoding import force_text
from django.conf import settings
from markdown import markdown as do_markdown
from django.template.defaultfilters import stringfilter

@register.filter
def get_item(dictionary, key):
    return dictionary.get(key, False)

@register.filter
def r_i(value, i):
    return value.format(i=i)

@register.tag
def markdown(parser, token):
    nodelist = parser.parse(('endmarkdown',))
    bits = token.split_contents()
    parser.delete_first_token()
    return MarkdownNode(bits[1] if len(bits) > 1 else {}, nodelist)

class MarkdownNode(Node):
    def __init__(self, options, nodelist):
        self.options, self.nodelist = options, nodelist

    def render(self, context):
        value = self.nodelist.render(context)
        try:
            return mark_safe(do_markdown(value, self.options))
        except ImportError:
            if settings.DEBUG:
                raise TemplateSyntaxError("Error in `markdown` tag: "
                    "The Markdown library isn't installed.")
        return force_text(value)

@register.filter
@stringfilter
def endswith(value, suffix):
    return value.endswith(suffix)

@register.filter
@stringfilter
def escsquote(value):
    return value.replace('\'', '\\\'')