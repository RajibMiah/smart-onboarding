"""
File Introduction:
Module: collaboration.models
Role: Playlists, documentation pages, and step guides domain.

Responsibilities:
- Models playlists as ordered collections of clips (Playlist, PlaylistItem).
- Models documentation pages as ordered collections of clips with step notes
  (DocumentationPage, PageClipItem).
- Models numbered how-to steps anchored to a clip's timestamps (StepGuide).
"""

import uuid

from django.conf import settings
from django.db import models

from core.models import Organization
from media.models import Clip


class PlaylistQuerySet(models.QuerySet):
    def for_user(self, user):
        return self.filter(organization_id=user.organization_id)

    def in_workspace(self, organization):
        return self.filter(organization=organization)


class Playlist(models.Model):
    class Visibility(models.TextChoices):
        PUBLIC = "public", "Public"
        PRIVATE = "private", "Private"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="playlists")
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="playlists")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    cover_image_url = models.URLField(blank=True)
    visibility = models.CharField(max_length=20, choices=Visibility.choices, default=Visibility.PRIVATE)
    clips = models.ManyToManyField(Clip, through="PlaylistItem", related_name="playlists")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = PlaylistQuerySet.as_manager()

    class Meta:
        db_table = "apc_playlists"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["organization", "visibility"])]

    def __str__(self) -> str:
        return self.title


class PlaylistItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE, related_name="items")
    clip = models.ForeignKey(Clip, on_delete=models.CASCADE, related_name="playlist_items")
    position = models.PositiveIntegerField(default=0)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "apc_playlist_items"
        ordering = ["playlist", "position"]
        constraints = [
            models.UniqueConstraint(fields=["playlist", "clip"], name="uniq_clip_per_playlist"),
            models.UniqueConstraint(fields=["playlist", "position"], name="uniq_position_per_playlist"),
        ]

    def __str__(self) -> str:
        return f"{self.clip.title} @ {self.position} in {self.playlist.title}"


class DocumentationPage(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"

    class Visibility(models.TextChoices):
        PUBLIC = "public", "Public"
        PRIVATE = "private", "Private"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="pages")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pages")
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    content_markdown = models.TextField(blank=True)
    section_count = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    visibility = models.CharField(max_length=20, choices=Visibility.choices, default=Visibility.PRIVATE)
    clips = models.ManyToManyField(Clip, through="PageClipItem", related_name="documentation_pages")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "apc_pages"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["organization", "slug"], name="uniq_page_slug_per_org"),
        ]

    def __str__(self) -> str:
        return self.title


class PageClipItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    page = models.ForeignKey(DocumentationPage, on_delete=models.CASCADE, related_name="clip_items")
    clip = models.ForeignKey(Clip, on_delete=models.CASCADE, related_name="page_items")
    step_number = models.PositiveIntegerField(default=0)
    step_note = models.TextField(blank=True)

    class Meta:
        db_table = "apc_page_clip_items"
        ordering = ["page", "step_number"]
        constraints = [
            models.UniqueConstraint(fields=["page", "clip"], name="uniq_clip_per_page"),
        ]

    def __str__(self) -> str:
        return f"Step {self.step_number} of {self.page.title}"


class StepGuide(models.Model):
    """A numbered how-to step within a clip: timestamp, title, markdown body, snapshot."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    clip = models.ForeignKey(Clip, on_delete=models.CASCADE, related_name="step_guides")
    step_number = models.PositiveIntegerField()
    timestamp_seconds = models.DecimalField(max_digits=10, decimal_places=2)
    title = models.CharField(max_length=255)
    description_markdown = models.TextField(blank=True)
    snapshot_image_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "apc_step_guides"
        ordering = ["clip", "step_number"]
        constraints = [
            models.UniqueConstraint(fields=["clip", "step_number"], name="uniq_step_number_per_clip"),
        ]

    def __str__(self) -> str:
        return f"Step {self.step_number}: {self.title}"
