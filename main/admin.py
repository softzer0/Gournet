from django.contrib import admin
from . import models
from django.utils.translation import ugettext_lazy as _, ugettext
from related_admin import RelatedFieldAdmin, getter_for_related_field
from django.db.models import Count
from django.template.defaultfilters import truncatewords

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
        return super().get_queryset(request).annotate(like_count=Count('likes'), item_count=Count('item'), event_count=Count('event'))

    like_count, item_count, event_count = getter_for_related_field('like_count', 'like__count', _("like(s)")), getter_for_related_field('item_count', 'item__count', _("item(s)")), getter_for_related_field('event_count', 'event__count', _("event(s)"))

    def review_count(self, obj):
        return models.Comment.objects.filter(content_type__pk=models.get_content_types()['business'].pk, object_id=obj.pk).count()
    review_count.short_description = _("review(s)")


class BaseObjAdmin(admin.ModelAdmin):
    date_hierarchy = 'created'
    list_filter = ('created',)

    def name_text(self, obj):
        return truncatewords(obj.text if hasattr(obj, 'text') else obj.name, 15)
    name_text.short_description = _("name/text")

class DisLikeComment:
    def like_count(self, obj):
        return models.Like.objects.filter(content_type__pk=models.get_content_types()[type(obj)._meta.model_name].pk, object_id=obj.pk, is_dislike=False).count()
    like_count.short_description = _("like(s)")

    def dislike_count(self, obj):
        return models.Like.objects.filter(content_type__pk=models.get_content_types()[type(obj)._meta.model_name].pk, object_id=obj.pk, is_dislike=True).count()
    dislike_count.short_description = _("dislike(s)")

    def comment_count(self, obj):
        return models.Comment.objects.filter(content_type__pk=models.get_content_types()[type(obj)._meta.model_name].pk, object_id=obj.pk).count()
    comment_count.short_description = _("comment(s)")

@admin.register(models.Event)
class EventAdmin(BaseObjAdmin, DisLikeComment):
    list_display = ('id', 'business', 'name_text', 'when', 'like_count', 'dislike_count', 'comment_count', 'created')
    search_fields = ('business__name', 'text')

@admin.register(models.Item)
class ItemAdmin(BaseObjAdmin, DisLikeComment):
    list_filter = BaseObjAdmin.list_filter + ('category', 'has_image')
    list_display = ('id', 'business', 'category', 'name_text', 'price', 'like_count', 'dislike_count', 'comment_count', 'created', 'has_image')
    search_fields = ('business__name', 'name', 'price')

class Review(models.Comment):
    class Meta:
        proxy = True
        verbose_name = _("review")
        verbose_name_plural = _("reviews")

class CommentP(models.Comment):
    class Meta:
        proxy = True
        verbose_name = _("comment")
        verbose_name_plural = _("comments")

class BaseCommentAdmin(BaseObjAdmin, RelatedFieldAdmin):
    search_fields = ('person__username', 'person__first_name', 'person__last_name', 'text')
    list_display = ('person__username', 'person__first_name', 'person__last_name', 'text', 'created')

class StarsListFilter(admin.SimpleListFilter):
    title = _("stars")
    parameter_name = 'stars'

    def lookups(self, request, model_admin):
        return tuple((str(x), str(x)) for x in range(1, 6))

    def queryset(self, request, queryset):
        return queryset.filter(stars=self.value())

@admin.register(Review)
class ReviewAdmin(BaseCommentAdmin, DisLikeComment):
    exclude = ('status',)
    list_display = BaseCommentAdmin.list_display + ('stars', 'like_count', 'dislike_count', 'comment_count')
    list_filter = BaseCommentAdmin.list_filter + (StarsListFilter,)

    def get_queryset(self, request):
        return super().get_queryset(request).filter(main_comment__isnull=False)

@admin.register(CommentP)
class CommentAdmin(BaseCommentAdmin):
    exclude = ('main_comment', 'stars')
    list_filter = BaseCommentAdmin.list_filter + ('status',)

    def get_queryset(self, request):
        return super().get_queryset(request).filter(main_comment__isnull=True)
