"""Multi-track editor domain: timeline tracks and their timed overlay regions.

Normalizes the ER diagram's JSON overlay columns (APC_CLIP_METADATA's
video_track_config/blur_masks/text_overlays, APC_CLIP_SEGMENTS' timeline
window) into first-class, independently queryable and orderable tables.
"""

import uuid

from django.db import models

from media.models import Clip


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
    x = models.DecimalField(max_digits=5, decimal_places=2, help_text="Bounding box x, percent of frame width")
    y = models.DecimalField(max_digits=5, decimal_places=2, help_text="Bounding box y, percent of frame height")
    width = models.DecimalField(max_digits=5, decimal_places=2)
    height = models.DecimalField(max_digits=5, decimal_places=2)
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
    x = models.DecimalField(max_digits=5, decimal_places=2)
    y = models.DecimalField(max_digits=5, decimal_places=2)
    width = models.DecimalField(max_digits=5, decimal_places=2)
    height = models.DecimalField(max_digits=5, decimal_places=2)
    shape = models.CharField(max_length=20, choices=Shape.choices, default=Shape.RECTANGLE)
    blur_radius = models.PositiveSmallIntegerField(default=10)

    class Meta:
        db_table = "apc_blur_regions"
        ordering = ["track", "start_time"]

    def __str__(self) -> str:
        return f"Blur {self.start_time}s-{self.end_time}s"


class Cut(TimedRegion):
    """A non-destructive timeline decision over a source-media range.

    `KEEP` segments play at normal speed and need no explicit row (the
    absence of a cut over a range means "keep"); `CUT` removes the range
    entirely from playback; `SILENCE_SPEEDUP` keeps it but plays it back at
    `speed_multiplier`x, typically a range `detect-silence` flagged as dead
    air rather than something the editor removed outright.
    """

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
