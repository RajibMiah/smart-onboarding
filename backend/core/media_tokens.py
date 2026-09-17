"""
File Introduction:
Module: core.media_tokens
Role: Short-lived signed tokens for authenticating direct browser resource loads
(<video>/<audio> byte-range requests) that cannot carry an Authorization header.

Responsibilities:
- Issues a signed, time-limited token bound to a user id.
- Verifies a token and returns the user id it was issued for, or None if
  missing/invalid/expired.
"""

from django.conf import settings
from django.core import signing

MEDIA_TOKEN_SALT = "core.media_tokens"


def generate_media_token(user_id) -> str:
    return signing.TimestampSigner(salt=MEDIA_TOKEN_SALT).sign(str(user_id))


def verify_media_token(token: str) -> str | None:
    try:
        return signing.TimestampSigner(salt=MEDIA_TOKEN_SALT).unsign(
            token, max_age=settings.MEDIA_TOKEN_MAX_AGE_SECONDS
        )
    except signing.BadSignature:
        return None
