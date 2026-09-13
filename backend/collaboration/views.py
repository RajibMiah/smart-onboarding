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
