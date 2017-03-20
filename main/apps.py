from django.apps import AppConfig
from django.utils.translation import ugettext_lazy as _

class MainAppConfig(AppConfig):
    name = 'main'

    def ready(self):
        from . import models

        if not models.IS_SERVER:
            return

        from django.db.models import ForeignKey, Manager, Model
        from django.contrib.admin import register, SimpleListFilter
        from . import admin

        class ReviewManager(Manager):
            def get_queryset(self):
                return super().get_queryset().filter(content_type__pk=models.get_content_types()['business'].pk)

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
        attrs['likes'].model = models.Comment

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
