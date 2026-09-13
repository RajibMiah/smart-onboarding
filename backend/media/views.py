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
    serializer_class = MediaAssetSerializer
    permission_classes = [IsWorkspaceMember]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filterset_fields = ["asset_type", "status", "clip"]
    ordering_fields = ["created_at"]

    def get_queryset(self):
        return MediaAsset.objects.filter(clip__organization_id=self.request.user.organization_id)
