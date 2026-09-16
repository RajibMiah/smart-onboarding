"""
File Introduction:
Module: sharing.views
Role: HTTP entry points for share requests, plain shares, notifications, and the shared feed.

Responsibilities:
- Routes requests to selectors for reads and to domain services for writes/side effects.
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsWorkspaceMember

from . import selectors
from .serializers import (
    MediaShareRequestSerializer,
    NotificationSerializer,
    RequestActionSerializer,
    SharedContentSerializer,
)
from .services.handlers import (
    DatabaseNotifier,
    DjangoEmailSender,
    SharedContentService,
    ShareRequestService,
    build_shared_feed,
    mark_all_notifications_read,
    mark_notification_read,
)


def _share_request_service() -> ShareRequestService:
    return ShareRequestService(email_sender=DjangoEmailSender(), notifier=DatabaseNotifier())


def _shared_content_service() -> SharedContentService:
    return SharedContentService(notifier=DatabaseNotifier())


class MediaShareRequestViewSet(viewsets.ModelViewSet):
    serializer_class = MediaShareRequestSerializer
    permission_classes = [IsWorkspaceMember]
    filterset_fields = ["status", "priority", "content_type"]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        return selectors.media_share_requests_for_user(self.request.user, self.request.query_params.get("filter"))

    def perform_create(self, serializer):
        _share_request_service().create(serializer, self.request.user)

    @action(detail=True, methods=["post"], url_path="action")
    def resolve_action(self, request, pk=None):
        """Resolves a request: {"action": "approve"|"request_changes"|"complete", "note": "..."}."""
        instance = self.get_object()
        action_serializer = RequestActionSerializer(data=request.data)
        action_serializer.is_valid(raise_exception=True)

        instance = _share_request_service().resolve(
            instance,
            action=action_serializer.validated_data["action"],
            note=action_serializer.validated_data["note"],
            resolved_by=request.user,
        )
        return Response(MediaShareRequestSerializer(instance, context={"request": request}).data, status=status.HTTP_200_OK)


class SharedContentViewSet(viewsets.ModelViewSet):
    """Plain shares and the Share Management dashboard: capability edits,
    cascade revocation, and the scoped dashboard listing."""

    serializer_class = SharedContentSerializer
    permission_classes = [IsWorkspaceMember]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return selectors.shared_content_for_user(self.request.user, self.request.query_params.get("filter"))

    def perform_create(self, serializer):
        _shared_content_service().create(serializer, self.request.user)

    def perform_update(self, serializer):
        _shared_content_service().update(serializer, self.request.user)

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        instance = _shared_content_service().revoke(self.get_object(), request.user)
        return Response(SharedContentSerializer(instance, context={"request": request}).data)

    @action(detail=False, methods=["get"])
    def dashboard(self, request):
        queryset = selectors.shared_content_dashboard(request.user, request.query_params)
        serializer = SharedContentSerializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)


class SharedFeedView(APIView):
    """GET /api/v1/sharing/feed/?scope=with_me|by_me — merges SharedContent + MediaShareRequest into one feed."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        scope = request.query_params.get("scope", "with_me")
        items = build_shared_feed(request.user, scope, request)
        return Response({"count": len(items), "results": items})


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["is_read", "notification_type"]

    def get_queryset(self):
        return selectors.notifications_for_user(self.request.user.id)

    @action(detail=True, methods=["patch"], url_path="read")
    def mark_read(self, request, pk=None):
        instance = mark_notification_read(self.get_object())
        return Response(NotificationSerializer(instance).data)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        updated = mark_all_notifications_read(request.user.id)
        return Response({"updated": updated})
