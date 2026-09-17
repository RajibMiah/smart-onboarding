"""
File Introduction:
Module: core.urls
Role: URL routing for authentication and account-management endpoints.

Responsibilities:
- Maps the auth/register/login/refresh/logout/me routes to their views.
"""

from django.urls import path

from .views import (
    LoginView,
    LogoutView,
    MeAvatarUploadView,
    MeView,
    RefreshView,
    RegisterView,
    health_check,
)

urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("me/avatar/", MeAvatarUploadView.as_view(), name="auth-me-avatar"),
]
