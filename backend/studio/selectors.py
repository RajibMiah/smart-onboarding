"""
File Introduction:
Module: studio.selectors
Role: Read-only query layer for timeline tracks, their timed regions, and Auto-Edit pipeline lookups.

Responsibilities:
- Provides workspace-scoped querysets for each region type.
- Provides the clip and next-track-order lookups the Auto-Edit pipeline needs.
"""

from __future__ import annotations

from django.db.models import Max, QuerySet

from media.models import Clip

from .models import BlurRegion, Cut, TextOverlay, TimelineTrack, TranscriptSegment, ZoomRegion


def timeline_tracks_for_organization(organization_id) -> QuerySet[TimelineTrack]:
    return TimelineTrack.objects.filter(clip__organization_id=organization_id).prefetch_related(
        "zoom_regions", "blur_regions", "text_overlays", "cuts"
    )


def zoom_regions_for_organization(organization_id) -> QuerySet[ZoomRegion]:
    return ZoomRegion.objects.filter(track__clip__organization_id=organization_id)


def blur_regions_for_organization(organization_id) -> QuerySet[BlurRegion]:
    return BlurRegion.objects.filter(track__clip__organization_id=organization_id)


def text_overlays_for_organization(organization_id) -> QuerySet[TextOverlay]:
    return TextOverlay.objects.filter(track__clip__organization_id=organization_id)


def cuts_for_organization(organization_id) -> QuerySet[Cut]:
    return Cut.objects.filter(track__clip__organization_id=organization_id)


def transcript_segments_for_organization(organization_id) -> QuerySet[TranscriptSegment]:
    return TranscriptSegment.objects.filter(track__clip__organization_id=organization_id)


def clip_for_auto_edit(clip_id) -> Clip:
    return Clip.objects.select_related("organization").get(id=clip_id)


def next_track_order(clip: Clip) -> int:
    return (TimelineTrack.objects.filter(clip=clip).aggregate(Max("order"))["order__max"] or 0) + 1
