"""
File Introduction:
Module: studio.models
Role: Multi-track editor domain — timeline tracks and their timed overlay regions.

Responsibilities:
- Represents a clip's timeline as ordered tracks (video/audio/zoom/blur/text/cut).
- Models each region type (zoom, blur, text overlay, cut, transcript segment) as an
  independently queryable, orderable row anchored to a track.
"""

import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from media.models import Clip

_PCT_VALIDATORS = [MinValueValidator(0), MaxValueValidator(100)]


class TimelineTrack(models.Model):
    class TrackType(models.TextChoices):
        VIDEO = "video", "Video"
        AUDIO = "audio", "Audio"
        ZOOM = "zoom", "Zoom"
        BLUR = "blur", "Blur"
        TEXT = "text", "Text"
        CUT = "cut", "Cut"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    clip = models.ForeignKey(Clip, on_delete=models.CASCADE, related_name="tracks")
    track_type = models.CharField(max_length=20, choices=TrackType.choices)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "apc_timeline_tracks"
        ordering = ["clip", "order"]
        constraints = [
            models.UniqueConstraint(fields=["clip", "order"], name="uniq_track_order_per_clip"),
        ]

    def __str__(self) -> str:
        return f"{self.get_track_type_display()} track #{self.order} ({self.clip.title})"


class TimedRegion(models.Model):
    """Shared start/end timing for a region anchored to a timeline track."""

    start_time = models.DecimalField(max_digits=10, decimal_places=3)
    end_time = models.DecimalField(max_digits=10, decimal_places=3)

    class Meta:
        abstract = True


class ZoomRegion(TimedRegion):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    track = models.ForeignKey(TimelineTrack, on_delete=models.CASCADE, related_name="zoom_regions")
    position_x = models.DecimalField(
        max_digits=5, decimal_places=2, validators=_PCT_VALIDATORS, help_text="Bounding box left edge, percent of frame width."
    )
    position_y = models.DecimalField(
        max_digits=5, decimal_places=2, validators=_PCT_VALIDATORS, help_text="Bounding box top edge, percent of frame height."
    )
    width_pct = models.DecimalField(
        max_digits=5, decimal_places=2, validators=_PCT_VALIDATORS, help_text="Bounding box width, percent of frame width."
    )
    height_pct = models.DecimalField(
        max_digits=5, decimal_places=2, validators=_PCT_VALIDATORS, help_text="Bounding box height, percent of frame height."
    )
    scale_factor = models.DecimalField(max_digits=4, decimal_places=2, default=1.5)

    class Meta:
        db_table = "apc_zoom_regions"
        ordering = ["track", "start_time"]

    def __str__(self) -> str:
        return f"Zoom {self.start_time}s-{self.end_time}s"


class BlurRegion(TimedRegion):
    class Shape(models.TextChoices):
        RECTANGLE = "rectangle", "Rectangle"
        ELLIPSE = "ellipse", "Ellipse"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    track = models.ForeignKey(TimelineTrack, on_delete=models.CASCADE, related_name="blur_regions")
    position_x = models.DecimalField(
        max_digits=5, decimal_places=2, validators=_PCT_VALIDATORS, help_text="Bounding box left edge, percent of frame width."
    )
    position_y = models.DecimalField(
        max_digits=5, decimal_places=2, validators=_PCT_VALIDATORS, help_text="Bounding box top edge, percent of frame height."
    )
    width_pct = models.DecimalField(
        max_digits=5, decimal_places=2, validators=_PCT_VALIDATORS, help_text="Bounding box width, percent of frame width."
    )
    height_pct = models.DecimalField(
        max_digits=5, decimal_places=2, validators=_PCT_VALIDATORS, help_text="Bounding box height, percent of frame height."
    )
    shape = models.CharField(max_length=20, choices=Shape.choices, default=Shape.RECTANGLE)
    blur_radius = models.PositiveSmallIntegerField(default=10)

    class Meta:
        db_table = "apc_blur_regions"
        ordering = ["track", "start_time"]

    def __str__(self) -> str:
        return f"Blur {self.start_time}s-{self.end_time}s"


class Cut(TimedRegion):
    """A non-destructive timeline decision over a source-media range: KEEP
    (implicit, no row), CUT (removed from playback), or SILENCE_SPEEDUP
    (kept, played back at `speed_multiplier`x)."""

    class CutType(models.TextChoices):
        KEEP = "keep", "Keep"
        CUT = "cut", "Cut"
        SILENCE_SPEEDUP = "silence_speedup", "Silence speedup"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    track = models.ForeignKey(TimelineTrack, on_delete=models.CASCADE, related_name="cuts")
    cut_type = models.CharField(max_length=20, choices=CutType.choices, default=CutType.CUT)
    speed_multiplier = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = "apc_cuts"
        ordering = ["track", "start_time"]

    def __str__(self) -> str:
        return f"{self.get_cut_type_display()} {self.start_time}s-{self.end_time}s"


class TextOverlay(TimedRegion):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    track = models.ForeignKey(TimelineTrack, on_delete=models.CASCADE, related_name="text_overlays")
    content = models.TextField()
    position_x = models.DecimalField(max_digits=5, decimal_places=2)
    position_y = models.DecimalField(max_digits=5, decimal_places=2)
    font_size = models.PositiveSmallIntegerField(default=24)
    color = models.CharField(max_length=20, default="#FFFFFF")
    background_color = models.CharField(max_length=20, blank=True)

    class Meta:
        db_table = "apc_text_overlays"
        ordering = ["track", "start_time"]

    def __str__(self) -> str:
        return f"Text overlay {self.start_time}s-{self.end_time}s"


class TranscriptSegment(TimedRegion):
    """One AI Auto-Edit voiceover script line, anchored to an `audio`-type
    track. `original_text` is the verbatim transcription; `script_text` is
    the same span after refinement."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    track = models.ForeignKey(TimelineTrack, on_delete=models.CASCADE, related_name="transcript_segments")
    original_text = models.TextField(blank=True)
    script_text = models.TextField()

    class Meta:
        db_table = "apc_transcript_segments"
        ordering = ["track", "start_time"]

    def __str__(self) -> str:
        return f"Transcript {self.start_time}s-{self.end_time}s"
