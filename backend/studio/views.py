"""
File Introduction:
Module: studio.views
Role: HTTP entry points for timeline tracks and their timed regions.

Responsibilities:
- Routes requests to serializers and workspace-scoped selectors.
"""

from rest_framework import viewsets

from core.permissions import IsWorkspaceMember

from . import selectors
from .serializers import (
    BlurRegionSerializer,
    CutSerializer,
    TextOverlaySerializer,
    TimelineTrackSerializer,
    TranscriptSegmentSerializer,
    ZoomRegionSerializer,
)


class TimelineTrackViewSet(viewsets.ModelViewSet):
    serializer_class = TimelineTrackSerializer
    permission_classes = [IsWorkspaceMember]
    filterset_fields = ["clip", "track_type"]

    def get_queryset(self):
        return selectors.timeline_tracks_for_organization(self.request.user.organization_id)


class ZoomRegionViewSet(viewsets.ModelViewSet):
    serializer_class = ZoomRegionSerializer
    permission_classes = [IsWorkspaceMember]
    filterset_fields = ["track"]

    def get_queryset(self):
        return selectors.zoom_regions_for_organization(self.request.user.organization_id)


class BlurRegionViewSet(viewsets.ModelViewSet):
    serializer_class = BlurRegionSerializer
    permission_classes = [IsWorkspaceMember]
    filterset_fields = ["track"]

    def get_queryset(self):
        return selectors.blur_regions_for_organization(self.request.user.organization_id)


class TextOverlayViewSet(viewsets.ModelViewSet):
    serializer_class = TextOverlaySerializer
    permission_classes = [IsWorkspaceMember]
    filterset_fields = ["track"]

    def get_queryset(self):
        return selectors.text_overlays_for_organization(self.request.user.organization_id)


class CutViewSet(viewsets.ModelViewSet):
    serializer_class = CutSerializer
    permission_classes = [IsWorkspaceMember]
    filterset_fields = ["track"]

    def get_queryset(self):
        return selectors.cuts_for_organization(self.request.user.organization_id)


class TranscriptSegmentViewSet(viewsets.ModelViewSet):
    serializer_class = TranscriptSegmentSerializer
    permission_classes = [IsWorkspaceMember]
    filterset_fields = ["track"]

    def get_queryset(self):
        return selectors.transcript_segments_for_organization(self.request.user.organization_id)
