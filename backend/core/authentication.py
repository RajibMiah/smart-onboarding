"""
File Introduction:
Module: core.authentication
Role: Cookie-transported JWT authentication for the browser-facing frontend.

Responsibilities:
- Authenticates requests carrying the JWT in an HttpOnly cookie.
- Falls back to the standard Authorization header for non-browser clients.
"""

from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            return super().authenticate(request)

        raw_token = request.COOKIES.get(settings.JWT_AUTH_COOKIE)
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token
