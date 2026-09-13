from rest_framework import viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from core.permissions import IsProjectOwnerOrReadOnly, IsWorkspaceMember

from .models import Clip, MediaAsset
from .serializers import ClipSerializer, MediaAssetSerializer


class ClipViewSet(viewsets.ModelViewSet):
    serializer_class = ClipSerializer
    permission_classes = [IsWorkspaceMember, IsProjectOwnerOrReadOnly]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filterset_fields = ["status", "visibility", "author"]
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "title", "duration_seconds"]

    def get_queryset(self):
        return (
            Clip.objects.for_user(self.request.user)
            .select_related("author", "organization")
            .prefetch_related("assets")
        )

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization, author=self.request.user)


class MediaAssetViewSet(viewsets.ModelViewSet):
    """Workspace media bin: assets uploaded here exist independently of any
    `Clip` (see `MediaAsset.clip`) — the Studio's "Previous Medias" library."""

    serializer_class = MediaAssetSerializer
    permission_classes = [IsWorkspaceMember]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filterset_fields = ["asset_type", "status", "clip"]
    ordering_fields = ["created_at"]

    def get_queryset(self):
        return MediaAsset.objects.filter(organization_id=self.request.user.organization_id)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization, uploader=self.request.user)
