"""
File Introduction:
Module: media.services.handlers
Role: Domain services for clip mutation rules, media-asset uploads, the Watch payload, and Auto-Edit dispatch.

Responsibilities:
- Enforces the visibility-change permission rule on clip updates.
- Composes the Watch page's payload from the clip serializer and playlist/related-clip lookups.
- Derives upload-implied metadata for new media assets.
- Adapts Celery task dispatch/status polling to the AutoEditDispatcherProtocol/AutoEditStatusProviderProtocol.
"""

from __future__ import annotations

from celery.result import AsyncResult
from rest_framework.exceptions import PermissionDenied

from core.permissions import user_is_owner_or_admin
from studio.tasks import process_ai_auto_edit

from .. import selectors
from ..models import Clip, MediaAsset

# Celery task phase -> the Studio drawer's four named pipeline steps.
# PENDING/SUCCESS/FAILURE are Celery's built-in states; the rest are custom
# states studio/tasks.py reports as the pipeline progresses.
_AUTO_EDIT_PHASE_BY_STATE = {
    "PENDING": "Queued...",
    "TRANSCRIBING": "Transcribing...",
    "GENERATING_SCRIPT": "Ollama Generating Script...",
    "SYNTHESIZING_VOICE": "Synthesizing Voice...",
    "READY": "Ready",
    "SUCCESS": "Ready",
    "FAILURE": "Failed",
}


class CeleryAutoEditDispatcher:
    """`AutoEditDispatcherProtocol` backed by the real Celery task."""

    def dispatch(self, clip_id: str, user_id: str, options: dict) -> str:
        task = process_ai_auto_edit.delay(clip_id, user_id, options)
        return task.id


class CeleryAutoEditStatusProvider:
    """`AutoEditStatusProviderProtocol` backed by Celery's result backend."""

    def status(self, task_id: str) -> dict:
        result = AsyncResult(task_id)
        state = result.state
        payload = {"task_id": task_id, "state": state, "phase": _AUTO_EDIT_PHASE_BY_STATE.get(state, state)}
        if state == "SUCCESS":
            payload["result"] = result.result
        elif state == "FAILURE":
            payload["error"] = str(result.info)
        elif isinstance(result.info, dict):
            payload["phase"] = result.info.get("phase", payload["phase"])
        return payload


class ClipService:
    """Domain rules around clip mutation that go beyond plain field assignment."""

    @staticmethod
    def guard_visibility_change(request_data: dict, user, instance: Clip) -> None:
        """Changing visibility stays owner/admin-exclusive regardless of any delegated can_edit grant."""
        if "visibility" in request_data and not user_is_owner_or_admin(user, instance, owner_field="author"):
            raise PermissionDenied("Only this clip's owner or an admin can change its visibility.")

    @staticmethod
    def build_watch_payload(clip: Clip, serializer_context: dict, visible_queryset) -> dict:
        """Composes the Watch page's payload: the clip's full edit layers
        and step guides, plus playlist and related-clip context."""
        from collaboration.serializers import TheaterClipSerializer

        data = TheaterClipSerializer(clip, context=serializer_context).data
        data["playlist_context"] = selectors.playlist_context_for_clip(clip)
        data["related_clips"] = selectors.related_clips(visible_queryset, clip)
        return data


def derive_upload_defaults(uploaded_file, validated_data: dict) -> dict:
    """Metadata a direct upload implies but the client didn't already send."""
    if uploaded_file is None:
        return {}
    defaults = {}
    if "mime_type" not in validated_data:
        defaults["mime_type"] = uploaded_file.content_type or ""
    if "file_size_bytes" not in validated_data:
        defaults["file_size_bytes"] = uploaded_file.size
    if "status" not in validated_data:
        defaults["status"] = MediaAsset.Status.READY
    return defaults


class MediaAssetService:
    @staticmethod
    def create(serializer, user) -> MediaAsset:
        validated_data = serializer.validated_data
        defaults = derive_upload_defaults(validated_data.get("file"), validated_data)
        return serializer.save(organization=user.organization, uploader=user, **defaults)
