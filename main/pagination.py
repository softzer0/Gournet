from django.conf import settings
from rest_framework import pagination
from rest_framework.response import Response


class PageNumberPagination(pagination.PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 1000

    def get_paginated_response(self, data):
        return Response({
            #'links': {
            #   'next': self.get_next_link(),
            #   'previous': self.get_previous_link()
            #},
            'page_count': self.page.paginator.num_pages,
            'results': data
        })

class NotificationPagination(PageNumberPagination):
    page_size = settings.NOTIFICATION_PAGE_SIZE

class EventPagination(PageNumberPagination):
    page_size = settings.EVENT_PAGE_SIZE


class LimitOffsetPagination(pagination.LimitOffsetPagination):
    default_limit = settings.COMMENT_PAGE_SIZE

    def get_paginated_response(self, data):
        return Response({
            'count': self.count,
            'results': data
        })

class CommentPagination(LimitOffsetPagination):
    default_limit = settings.COMMENT_PAGE_SIZE

class SearchPagination(LimitOffsetPagination):
    default_limit = settings.SEARCH_PAGE_SIZE