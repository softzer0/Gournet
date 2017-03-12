from django.contrib import admin
from . import models
from django.utils.translation import ugettext_lazy as _
from related_admin import RelatedFieldAdmin

class BaseAdmin(admin.ModelAdmin):
    exclude = ('loc_projected',)

@admin.register(models.User)
class UserAdmin(BaseAdmin):
    date_hierarchy = 'date_joined'
    list_display = ('username', 'first_name', 'last_name', 'date_joined', 'is_manager')
    list_filter = ('date_joined', 'gender', 'is_manager')
    search_fields = ('username', 'first_name', 'last_name')

@admin.register(models.Business)
class BusinessAdmin(BaseAdmin):
    list_filter = ('type', 'is_published')
    list_display = ('id', 'shortname', 'type', 'name', 'is_published')
    search_fields = ('shortname', 'name')


class BaseObjAdmin(admin.ModelAdmin):
    date_hierarchy = 'created'
    list_filter = ('created',)

@admin.register(models.Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('id', 'business', 'when', 'created')
    search_fields = ('business__name', 'text')

@admin.register(models.Item)
class ItemAdmin(BaseObjAdmin):
    list_filter = BaseObjAdmin.list_filter + ('category', 'has_image')
    list_display = ('id', 'business', 'category', 'name', 'price', 'created', 'has_image')
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
    list_display = ('person__username', 'person__first_name', 'person__last_name', 'created')

@admin.register(Review)
class ReviewAdmin(BaseCommentAdmin):
    exclude = ('status',)
    list_display = BaseCommentAdmin.list_display + ('stars',)
    list_filter = BaseCommentAdmin.list_filter + ('stars',)

    def get_queryset(self, request):
        return super().get_queryset(request).filter(main_comment__isnull=False)

@admin.register(CommentP)
class CommentAdmin(BaseCommentAdmin):
    exclude = ('main_comment', 'stars')

    def get_queryset(self, request):
        return super().get_queryset(request).filter(main_comment__isnull=True)
