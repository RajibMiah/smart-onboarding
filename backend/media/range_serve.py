"""
File Introduction:
Module: media.range_serve
Role: Development-only media file serving with HTTP Range support and access control.

Responsibilities:
- Serves files under MEDIA_ROOT with Range/206 support, required for `<video>` seeking.
- Is the ONLY access-control checkpoint for raw clip-asset bytes: `MediaAssetViewSet`/
  `ClipViewSet` gate the JSON metadata, but a `<video src>` hits this URL directly, so
  authentication and clip/playlist visibility are enforced here before any file is served.
- Authenticates manually via `CookieJWTAuthentication`, since this route sits outside DRF
  and Django's `AuthenticationMiddleware` doesn't populate `request.user` for the
  JWT-in-cookie scheme this app uses.
"""

import mimetypes
import re
from pathlib import Path
from typing import BinaryIO

from django.conf import settings
from django.http import FileResponse, Http404, HttpRequest, HttpResponse
from django.utils._os import safe_join
from django.utils.http import http_date

_RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")


def _authenticated_user(request: HttpRequest):
    from core.authentication import CookieJWTAuthentication

    try:
        result = CookieJWTAuthentication().authenticate(request)
    except Exception:
        return None
    return result[0] if result else None


def _clip_is_streamable(user, clip) -> bool:
    """Whether `user` may stream `clip`: direct visibility on the clip, or
    membership in any playlist that is visible to them."""
    from collaboration.models import Playlist
    from core.permissions import user_can_view_object
    from media.models import Clip

    if user_can_view_object(
        user, clip, owner_field="author", content_type="clip", public_visibility_value=Clip.Visibility.PUBLISHED
    ):
        return True

    playlist_ids = clip.playlist_items.values_list("playlist_id", flat=True)
    return any(
        user_can_view_object(
            user,
            playlist,
            owner_field="owner",
            content_type="playlist",
            public_visibility_value=Playlist.Visibility.PUBLIC,
        )
        for playlist in Playlist.objects.filter(id__in=playlist_ids)
    )


def _authorize_clip_asset(request: HttpRequest, path: str) -> None:
    """Raises `Http404` (never 403, to avoid confirming a private file
    exists) unless this request may stream this file. Only `clip-assets/`
    paths are checked; thumbnails/avatars are already visible org-wide."""
    from media.models import MediaAsset

    if not path.startswith("clip-assets/"):
        return

    asset = MediaAsset.objects.filter(file=path).select_related("clip", "organization").first()
    if asset is None:
        return

    user = _authenticated_user(request)
    if user is None or user.organization_id != asset.organization_id:
        raise Http404("No such file.")

    if asset.clip_id is None:
        return

    if not _clip_is_streamable(user, asset.clip):
        raise Http404("No such file.")


class _BoundedFileReader:
    """Wraps an open file so `FileResponse` streams at most `remaining`
    bytes from the current seek position instead of reading to EOF."""

    def __init__(self, file_obj: BinaryIO, remaining: int) -> None:
        self._file_obj = file_obj
        self._remaining = remaining

    def read(self, chunk_size: int = 64 * 1024) -> bytes:
        if self._remaining <= 0:
            return b""
        chunk = self._file_obj.read(min(chunk_size, self._remaining))
        self._remaining -= len(chunk)
        return chunk

    def close(self) -> None:
        self._file_obj.close()


def serve_media_with_range(request: HttpRequest, path: str) -> HttpResponse:
    _authorize_clip_asset(request, path)
    try:
        full_path = Path(safe_join(settings.MEDIA_ROOT, path))
    except ValueError as exc:
        raise Http404("Invalid path.") from exc
    if not full_path.is_file():
        raise Http404("No such file.")

    file_size = full_path.stat().st_size
    content_type, _ = mimetypes.guess_type(str(full_path))
    content_type = content_type or "application/octet-stream"
    common_headers = {
        "Accept-Ranges": "bytes",
        "Last-Modified": http_date(full_path.stat().st_mtime),
        "Content-Disposition": f'inline; filename="{full_path.name}"',
        "Cross-Origin-Resource-Policy": "cross-origin",
    }

    range_match = _RANGE_RE.fullmatch(request.headers.get("Range", ""))
    if range_match is None:
        response = FileResponse(full_path.open("rb"), content_type=content_type)
        response["Content-Length"] = str(file_size)
        for header, value in common_headers.items():
            response[header] = value
        return response

    start_str, end_str = range_match.groups()
    start = int(start_str) if start_str else 0
    end = int(end_str) if end_str else file_size - 1
    end = min(end, file_size - 1)

    if start >= file_size or start > end:
        response = HttpResponse(status=416)
        response["Content-Range"] = f"bytes */{file_size}"
        return response

    length = end - start + 1
    file_obj = full_path.open("rb")
    file_obj.seek(start)

    response = FileResponse(_BoundedFileReader(file_obj, length), status=206, content_type=content_type)
    response["Content-Length"] = str(length)
    response["Content-Range"] = f"bytes {start}-{end}/{file_size}"
    for header, value in common_headers.items():
        response[header] = value
    return response
