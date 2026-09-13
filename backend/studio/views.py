from rest_framework import viewsets

from core.permissions import IsWorkspaceMember

from .models import BlurRegion, TextOverlay, TimelineTrack, ZoomRegion
from .serializers import (
    BlurRegionSerializer,
    TextOverlaySerializer,
    TimelineTrackSerializer,
    ZoomRegionSerializer,
)


class TimelineTrackViewSet(viewsets.ModelViewSet):
    serializer_class = TimelineTrackSerializer
    permission_classes = [IsWorkspaceMember]
    filterset_fields = ["clip", "track_type"]

    def get_queryset(self):
        return TimelineTrack.objects.filter(
            clip__organization_id=self.request.user.organization_id
        ).prefetch_related("zoom_regions", "blur_regions", "text_overlays")


class ZoomRegionViewSet(viewsets.ModelViewSet):
    serializer_class = ZoomRegionSerializer
    permission_classes = [IsWorkspaceMember]
    filterset_fields = ["track"]

    def get_queryset(self):
        return ZoomRegion.objects.filter(track__clip__organization_id=self.request.user.organization_id)


class BlurRegionViewSet(viewsets.ModelViewSet):
    serializer_class = BlurRegionSerializer
    permission_classes = [IsWorkspaceMember]
    filterset_fields = ["track"]

    def get_queryset(self):
        return BlurRegion.objects.filter(track__clip__organization_id=self.request.user.organization_id)


class TextOverlayViewSet(viewsets.ModelViewSet):
    serializer_class = TextOverlaySerializer
    permission_classes = [IsWorkspaceMember]
    filterset_fields = ["track"]

    def get_queryset(self):
        return TextOverlay.objects.filter(track__clip__organization_id=self.request.user.organization_id)
