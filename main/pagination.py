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
    page_size = settings.EVENTS_PAGE_SIZE