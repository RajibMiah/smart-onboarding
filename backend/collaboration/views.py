from django.db import transaction
from rest_framework import viewsets

from core.permissions import IsProjectOwnerOrReadOnly, IsWorkspaceMember

from .models import DocumentationPage, Playlist, PlaylistItem, StepGuide
from .serializers import (
    DocumentationPageSerializer,
    PlaylistItemSerializer,
    PlaylistSerializer,
    StepGuideSerializer,
)


class PlaylistViewSet(viewsets.ModelViewSet):
    serializer_class = PlaylistSerializer
    permission_classes = [IsWorkspaceMember, IsProjectOwnerOrReadOnly]
    filterset_fields = ["visibility", "owner"]
    search_fields = ["title", "description"]

    def get_queryset(self):
        return Playlist.objects.for_user(self.request.user).prefetch_related("items")

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization, owner=self.request.user)


class PlaylistItemViewSet(viewsets.ModelViewSet):
    serializer_class = PlaylistItemSerializer
    permission_classes = [IsWorkspaceMember]
    filterset_fields = ["playlist", "clip"]

    def get_queryset(self):
        return PlaylistItem.objects.filter(playlist__organization_id=self.request.user.organization_id)

    def perform_create(self, serializer):
        # `position` is server-assigned, not client-supplied — always append
        # after every existing item in this playlist. `select_for_update`
        # serializes concurrent adds to the same playlist so two simultaneous
        # requests can't both read the same max() and collide on one slot,
        # which the (playlist, position) unique constraint would otherwise reject.
        playlist = serializer.validated_data["playlist"]
        with transaction.atomic():
            existing = PlaylistItem.objects.select_for_update().filter(playlist=playlist)
            max_position = existing.order_by("-position").values_list("position", flat=True).first()
            next_position = 0 if max_position is None else max_position + 1
            serializer.save(position=next_position)


class DocumentationPageViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentationPageSerializer
    permission_classes = [IsWorkspaceMember, IsProjectOwnerOrReadOnly]
    filterset_fields = ["status", "visibility", "author"]
    search_fields = ["title", "content_markdown"]

    def get_queryset(self):
        return DocumentationPage.objects.filter(
            organization_id=self.request.user.organization_id
        ).prefetch_related("clip_items")

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization, author=self.request.user)


class StepGuideViewSet(viewsets.ModelViewSet):
    serializer_class = StepGuideSerializer
    permission_classes = [IsWorkspaceMember]
    filterset_fields = ["clip"]

    def get_queryset(self):
        return StepGuide.objects.filter(clip__organization_id=self.request.user.organization_id)
