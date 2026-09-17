"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path

from media.range_serve import serve_media_with_range

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("api.v1.urls")),
]

if settings.DEBUG:
    # Range-aware in place of the stock `static()`/`django.views.static.serve`
    # helper — see media/range_serve.py for why: without it, seeking a
    # <video> to an unbuffered position re-downloads the whole file.
    urlpatterns += [re_path(rf"^{settings.MEDIA_URL.lstrip('/')}(?P<path>.*)$", serve_media_with_range)]
    # gunicorn (unlike `runserver`) never auto-serves static files, so the
    # browsable API's CSS/JS 404 without this — collectstatic must have
    # already gathered them into STATIC_ROOT (done in docker-entrypoint.sh).
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    # Gives the DRF browsable API's "Log in" / "Log out" links somewhere to
    # post to (SessionAuthentication needs this — JWTAuthentication alone
    # has no browsable-API login form).
    urlpatterns += [path("api-auth/", include("rest_framework.urls"))]
