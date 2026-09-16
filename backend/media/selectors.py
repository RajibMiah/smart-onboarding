"""
File Introduction:
Module: media.selectors
Role: Read-only query layer for clips and media assets.

Responsibilities:
- Provides visibility-scoped clip querysets and organization-scoped asset querysets.
- Provides the Watch page's playlist-context and related-clips lookups.
"""

from __future__ import annotations

from django.db.models import QuerySet

from core.permissions import scoped_to_visible

from .models import Clip, MediaAsset


def clips_visible_to_user(user) -> QuerySet[Clip]:
    base = Clip.objects.for_user(user).select_related("author", "organization").prefetch_related("assets")
    return scoped_to_visible(
        base, user, owner_field="author", content_type="clip", public_visibility_value=Clip.Visibility.PUBLISHED
    )


def media_assets_for_organization(organization_id) -> QuerySet[MediaAsset]:
    return MediaAsset.objects.filter(organization_id=organization_id)


def playlist_context_for_clip(clip: Clip) -> dict | None:
    """The clip's earliest playlist membership, treated as its "home"
    playlist for the Watch page's sidebar."""
    playlist_item = clip.playlist_items.select_related("playlist").order_by("added_at").first()
    if playlist_item is None:
        return None

    playlist = playlist_item.playlist
    siblings = playlist.items.select_related("clip").order_by("position")
    return {
        "id": str(playlist.id),
        "title": playlist.title,
        "items": [
            {
                "id": str(item.clip_id),
                "title": item.clip.title,
                "duration_seconds": str(item.clip.duration_seconds),
                "position": item.position,
            }
            for item in siblings
        ],
    }


def related_clips(visible_queryset: QuerySet[Clip], clip: Clip, limit: int = 5) -> list[dict]:
    return [
        {"id": str(related.id), "title": related.title, "duration_seconds": str(related.duration_seconds)}
        for related in visible_queryset.filter(author_id=clip.author_id).exclude(id=clip.id).order_by("-created_at")[
            :limit
        ]
    ]
