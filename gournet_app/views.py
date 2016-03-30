from django.shortcuts import render


def pagetest(request):
    if request.user.is_authenticated():
        return render(request, 'hidden.html')
    else:
        return render(request, 'error.html')
