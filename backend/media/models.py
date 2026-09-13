"""Core project & recorded media domain: maps to APC_CLIPS and APC_CLIP_ASSETS."""

import uuid

from django.conf import settings
from django.db import models

from core.models import Organization, TimeStampedModel


class ClipQuerySet(models.QuerySet):
    def for_user(self, user):
        return self.filter(organization_id=user.organization_id)

    def in_workspace(self, organization):
        return self.filter(organization=organization)

    def published(self):
        return self.filter(visibility=Clip.Visibility.PUBLISHED)


class Clip(TimeStampedModel):
    """A recorded/edited video project."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    class Visibility(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        PRIVATE = "private", "Private"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="clips")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="clips")
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    description = models.TextField(blank=True)
    language = models.CharField(max_length=10, default="en")
    duration_seconds = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    thumbnail = models.ImageField(upload_to="clip-thumbnails/%Y/%m/%d/", blank=True, null=True)
    thumbnail_url = models.URLField(blank=True, help_text="External thumbnail URL, used when no file is uploaded.")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    visibility = models.CharField(max_length=20, choices=Visibility.choices, default=Visibility.DRAFT)

    objects = ClipQuerySet.as_manager()

    class Meta:
        db_table = "apc_clips"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["organization", "slug"], name="uniq_clip_slug_per_org"),
        ]
        indexes = [
            models.Index(fields=["organization", "visibility"]),
            models.Index(fields=["author"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return self.title


class MediaAsset(TimeStampedModel):
    """A stored file for a workspace: a raw recording/upload, transcoded output,
    thumbnail, caption track, or overlay graphic. `clip` is optional — an asset
    uploaded into the Studio's media bin exists at the workspace level first
    and is only linked to a `Clip` once (if ever) it's saved as part of one.
    """

    class AssetType(models.TextChoices):
        VIDEO = "video", "Video"
        AUDIO = "audio", "Audio"
        THUMBNAIL = "thumbnail", "Thumbnail"
        CAPTION = "caption", "Caption"
        OVERLAY = "overlay", "Overlay"

    class Status(models.TextChoices):
        UPLOADING = "uploading", "Uploading"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="media_assets")
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="uploaded_media_assets"
    )
    clip = models.ForeignKey(Clip, on_delete=models.CASCADE, related_name="assets", null=True, blank=True)
    title = models.CharField(max_length=255, blank=True)
    asset_type = models.CharField(max_length=20, choices=AssetType.choices, default=AssetType.VIDEO)
    file = models.FileField(upload_to="clip-assets/%Y/%m/%d/", blank=True, null=True)
    file_url = models.URLField(blank=True, help_text="External CDN/S3 URL, used when no file is uploaded.")
    mime_type = models.CharField(max_length=80, blank=True)
    file_size_bytes = models.BigIntegerField(default=0)
    resolution = models.CharField(max_length=20, blank=True, help_text="e.g. 1920x1080")
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    duration = models.FloatField(default=0.0, help_text="Duration in seconds, for video/audio assets.")
    framerate = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UPLOADING)

    class Meta:
        db_table = "apc_clip_assets"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["clip", "asset_type"]),
            models.Index(fields=["organization", "asset_type"]),
        ]

    def __str__(self) -> str:
        return self.title or f"{self.get_asset_type_display()} asset"
