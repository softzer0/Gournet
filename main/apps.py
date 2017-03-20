from django.apps import AppConfig
from django.utils.translation import ugettext_lazy as _

class MainAppConfig(AppConfig):
    name = 'main'

    def ready(self):
        from sys import argv
        if len(argv) == 1 or argv[1] in ('makemigrations', 'migrate'):
            return

        from . import models
        from django.db.models import ForeignKey, Manager, Model
        from django.contrib.admin import register, SimpleListFilter
        from django.contrib.contenttypes.models import ContentType
        from . import admin

        class ReviewManager(Manager):
            def get_queryset(self):
                return super().get_queryset().filter(content_type__pk=ContentType.objects.get(model='business').pk)

        class ReviewMeta:
            db_table = models.Comment._meta.db_table
            verbose_name = _("review")
            verbose_name_plural = _("reviews")

        attrs = {}
        for f in models.Comment._meta.get_fields():
            if f.name not in ('object_id', 'content_object', 'status'):
                attrs[f.name] = f
        attrs['object'] = ForeignKey(models.Business)
        attrs['objects'] = ReviewManager()
        attrs['Meta'] = ReviewMeta
        attrs['__module__'] = 'main.models'
        setattr(models, 'Review', type('Review', (Model,), attrs))
        models.Review.content_object = property(lambda: self.object)
        ContentType._meta.default_manager._cache[ContentType._meta.default_manager.db] = {ContentType.objects.get(model='review').pk: ContentType.objects.get(model='comment'), ('main', 'review'): ContentType.objects.get(model='comment')}

        class StarsListFilter(SimpleListFilter):
            title = _("stars")
            parameter_name = 'stars'

            def lookups(self, request, model_admin):
                return tuple((str(x), str(x)) for x in range(1, 6))

            def queryset(self, request, queryset):
                return queryset.filter(stars=self.value()) if self.value() else queryset

        @register(models.Review)
        class ReviewAdmin(admin.BaseCommentAdmin, admin.DisLike, admin.Comment):
            exclude = ('status',)
            list_display = admin.BaseCommentAdmin.list_display + ('stars', 'like_count', 'dislike_count', 'comment_count')
            list_filter = admin.BaseCommentAdmin.list_filter + (StarsListFilter,)
            model_name = 'comment'
