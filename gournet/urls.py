from django.conf.urls import url, include
from django.contrib import admin
# from rest_framework_jwt.views import obtain_jwt_token

urlpatterns = [
    url(r'^admin/', admin.site.urls),
#    url(r'^api-token-auth/', obtain_jwt_token),
    url(r'^api-auth/', include('rest_framework.urls', namespace='rest_framework')),
    url(r'', include('authorization.urls')),
    url(r'', include('gournet_app.urls')),
]