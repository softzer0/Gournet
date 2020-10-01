from django.conf import settings
from rest_framework import pagination
from rest_framework.response import Response
from django.utils.http import urlencode
from base64 import b64encode

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

class FeedPagination(PageNumberPagination):
    page_size = settings.EVENT_PAGE_SIZE

class WaiterPagination(PageNumberPagination):
    page_size = settings.SEARCH_PAGE_SIZE


class CursorPagination(pagination.CursorPagination):
    page_size = PageNumberPagination.page_size

    def encode_cursor(self, cursor):
        """
        Given a Cursor instance, return an url with encoded cursor.
        """
        tokens = {}
        if cursor.offset != 0:
            tokens['o'] = str(cursor.offset)
        if cursor.reverse:
            tokens['r'] = '1'
        if cursor.position is not None:
            tokens['p'] = cursor.position

        return b64encode(urlencode(tokens, doseq=True).encode('ascii')).decode('ascii')

class FriendsPagination(CursorPagination):
    ordering = '-date_joined'

class EventPagination(CursorPagination):
    page_size = settings.EVENT_PAGE_SIZE

class LikePagination(CursorPagination):
    ordering = '-date'

class CommentPagination(CursorPagination):
    page_size = settings.COMMENT_PAGE_SIZE

class CommentDefPagination(CommentPagination):
    ordering = 'created'

class UserPagePagination(CommentPagination):
    ordering = '-sort'

class SearchPagination(CursorPagination):
    page_size = settings.SEARCH_PAGE_SIZE

class UserPagination(SearchPagination):
    ordering = '-date_joined'

class ReminderPagination(CursorPagination):
    ordering = '-when'