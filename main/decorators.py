from functools import wraps
from django.utils.decorators import available_attrs
from django.shortcuts import redirect
from django.conf import settings
from django.contrib.auth.decorators import user_passes_test

REDIRECT_URL = settings.LOGIN_REDIRECT_URL
def user_passes_test_cust(test_func):
    """
    Decorator for views that checks that the user passes the given test,
    redirecting to the index page if necessary. The test should be a callable
    that takes the user object and returns True if the user passes.
    """

    def decorator(view_func):
        @wraps(view_func, assigned=available_attrs(view_func))
        def _wrapped_view(request, *args, **kwargs):
            if test_func(request.user):
                return view_func(request, *args, **kwargs)
            return redirect(REDIRECT_URL)
        return _wrapped_view
    return decorator

login_forbidden = user_passes_test_cust(lambda u: u.is_anonymous)


def request_passes_test(test_func):
    def decorator(view_func):
        @wraps(view_func, assigned=available_attrs(view_func))
        def _wrapped_view(request, *args, **kwargs):
            if test_func(request, *args, **kwargs):
                return view_func(request, *args, **kwargs)
            return user_passes_test(lambda _: False)(view_func)(request, *args, **kwargs)
        return _wrapped_view
    return decorator


def table_session_check(post=None):
    def decorator(view_func):
        setattr(view_func, 'TABLE_SESSION_CHECK', post)
        return view_func
    return decorator
