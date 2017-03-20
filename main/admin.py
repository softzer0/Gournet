from django.contrib import admin
from . import models
from django.utils.translation import ugettext_lazy as _, ugettext
from related_admin import RelatedFieldAdmin, getter_for_related_field
from django.db.models import Count, Avg
from django.template.defaultfilters import truncatewords
from django.contrib.contenttypes.models import ContentType

class BaseAdmin(admin.ModelAdmin):
    exclude = ('loc_projected',)

@admin.register(models.User)
class UserAdmin(BaseAdmin):
    date_hierarchy = 'date_joined'
    list_display = ('username', 'first_name', 'last_name', 'date_joined', 'is_manager')
    list_filter = ('date_joined', 'gender', 'is_manager')
    search_fields = ('username', 'first_name', 'last_name')

class HasItemsFilter(admin.SimpleListFilter):
    title = _("has any item?")
    parameter_name = 'has_items'

    def lookups(self, request, model_admin):
        return (('', ugettext("Yes")), ('not', ugettext("No")))

    def queryset(self, request, queryset):
        return queryset.extra(where=[self.value()+' exists (select 1 from main_item where main_item.business_id = main_business.id)']) if self.value() is not None else queryset

@admin.register(models.Business)
class BusinessAdmin(BaseAdmin):
    list_filter = ('type', 'is_published', HasItemsFilter)
    list_display = ('id', 'shortname', 'type', 'name', 'like_count', 'item_count', 'event_count', 'review_count', 'is_published')
    search_fields = ('shortname', 'name')

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(like_count=Count('likes', distinct=True), item_count=Count('item', distinct=True), event_count=Count('event', distinct=True))

    like_count, item_count, event_count = getter_for_related_field('like_count', short_description=_("like(s)")), getter_for_related_field('item_count', short_description=_("item(s)")), getter_for_related_field('event_count', short_description=_("event(s)"))

    def review_count(self, obj):
        return models.Review.objects.filter(object_id=obj.pk).count()
    review_count.short_description = _("review(s)")


class BaseObjAdmin(admin.ModelAdmin):
    date_hierarchy = 'created'
    list_filter = ('created',)

    def name_text(self, obj):
        return truncatewords(obj.text if hasattr(obj, 'text') else obj.name, 15)
    name_text.short_description = _("name/text")

def filter_relation(self, model, obj):
    return getattr(models, model).objects.filter(content_type__pk=ContentType.objects.get(model=type(obj)._meta.model_name if not hasattr(self, 'model_name') else self.model_name).pk, object_id=obj.pk)

class DisLike:
    def like_count(self, obj):
        return filter_relation(self, 'Like', obj).filter(is_dislike=False).count()
    like_count.short_description = _("like(s)")

    def dislike_count(self, obj):
        return filter_relation(self, 'Like', obj).filter(is_dislike=True).count()
    dislike_count.short_description = _("dislike(s)")

class Comment:
    def comment_count(self, obj):
        return filter_relation(self, 'Comment', obj).count()
    comment_count.short_description = _("comment(s)")

@admin.register(models.Event)
class EventAdmin(BaseObjAdmin, DisLike, Comment):
    list_display = ('id', 'business', 'name_text', 'when', 'like_count', 'dislike_count', 'comment_count', 'created')
    search_fields = ('business__name', 'text')

@admin.register(models.Item)
class ItemAdmin(BaseObjAdmin, DisLike, Comment):
    list_filter = BaseObjAdmin.list_filter + ('category', 'has_image')
    list_display = ('id', 'business', 'category', 'name_text', 'price', 'stars_avg', 'stars_count', 'comment_count', 'created', 'has_image')
    search_fields = ('business__name', 'name', 'price')

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(stars_count=Count('likes__stars'), stars_avg=Avg('likes__stars'))

    stars_count, stars_avg = getter_for_related_field('stars_count', short_description=_("star count")), getter_for_related_field('stars_avg', short_description=_("rating"))

class CommentP(models.Comment):
    class Meta:
        proxy = True
        verbose_name = _("comment")
        verbose_name_plural = _("comments")

class BaseCommentAdmin(BaseObjAdmin, RelatedFieldAdmin):
    search_fields = ('person__username', 'person__first_name', 'person__last_name', 'text')
    list_display = ('person__username', 'person__first_name', 'person__last_name', 'text', 'created')

@admin.register(CommentP)
class CommentAdmin(BaseCommentAdmin):
    list_display = ('id',) + BaseCommentAdmin.list_display
    exclude = ('main_comment', 'stars')
    list_filter = BaseCommentAdmin.list_filter + ('status',)

    def get_queryset(self, request):
        return super().get_queryset(request).exclude(content_type__pk=ContentType.objects.get(model='business').pk)
