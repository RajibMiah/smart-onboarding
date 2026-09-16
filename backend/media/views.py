"""
File Introduction:
Module: media.views
Role: HTTP entry points for clips, media assets, and the AI Auto-Edit dispatch/status routes.

Responsibilities:
- Routes requests to selectors for reads and to domain services for writes/orchestration.
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from core.permissions import IsOwnerOrDelegatedEditor, IsWorkspaceMember
from studio.serializers import AutoEditRequestSerializer

from . import selectors
from .serializers import ClipSerializer, MediaAssetSerializer
from .services.handlers import (
    CeleryAutoEditDispatcher,
    CeleryAutoEditStatusProvider,
    ClipService,
    MediaAssetService,
)


class ClipViewSet(viewsets.ModelViewSet):
    serializer_class = ClipSerializer
    permission_classes = [IsWorkspaceMember, IsOwnerOrDelegatedEditor]
    owner_field = "author"
    content_type = "clip"
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filterset_fields = ["status", "visibility", "author"]
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "title", "duration_seconds"]

    def get_queryset(self):
        return selectors.clips_visible_to_user(self.request.user)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization, author=self.request.user)

    def perform_update(self, serializer):
        ClipService.guard_visibility_change(self.request.data, self.request.user, serializer.instance)
        serializer.save()

    @action(detail=True, methods=["get"])
    def watch(self, request, pk=None):
        clip = self.get_object()
        data = ClipService.build_watch_payload(clip, self.get_serializer_context(), self.get_queryset())
        return Response(data)

    @action(detail=True, methods=["post"], url_path="auto-edit")
    def auto_edit(self, request, pk=None):
        """Launches the AI Auto-Edit & Voiceover pipeline for this clip in the background."""
        clip = self.get_object()
        serializer = AutoEditRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        options = dict(serializer.validated_data)
        # Celery's task message is JSON over the wire; stringify explicitly
        # rather than relying on the encoder to round-trip Decimal.
        options["silence_speed_multiplier"] = str(options["silence_speed_multiplier"])

        task_id = CeleryAutoEditDispatcher().dispatch(str(clip.id), str(request.user.id), options)
        return Response({"task_id": task_id, "status": "processing"}, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["get"], url_path="ai-status")
    def ai_status(self, request, pk=None):
        """Polled by `useAutoEditJob` for the task started by `auto_edit`."""
        self.get_object()
        task_id = request.query_params.get("task_id")
        if not task_id:
            return Response({"detail": "task_id query parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        return Response(CeleryAutoEditStatusProvider().status(task_id))


class MediaAssetViewSet(viewsets.ModelViewSet):
    """Workspace media bin: assets that exist independently of any Clip."""

    serializer_class = MediaAssetSerializer
    permission_classes = [IsWorkspaceMember]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filterset_fields = ["asset_type", "status", "clip"]
    ordering_fields = ["created_at"]

    def get_queryset(self):
        return selectors.media_assets_for_organization(self.request.user.organization_id)

    def perform_create(self, serializer):
        MediaAssetService.create(serializer, self.request.user)
