from functools import wraps
from django.utils.decorators import available_attrs
from django.shortcuts import redirect


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
            return redirect('/')
        return _wrapped_view
    return decorator


ifauth_redir = user_passes_test_cust(lambda u: u.is_anonymous())
