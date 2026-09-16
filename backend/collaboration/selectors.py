"""
File Introduction:
Module: collaboration.selectors
Role: Read-only query layer for playlists, playlist items, documentation pages, and step guides.

Responsibilities:
- Provides visibility-scoped playlist querysets and organization-scoped item/page/step querysets.
- Provides the row-locked queryset used for concurrency-safe playlist item writes.
"""

from __future__ import annotations

from django.db.models import QuerySet

from core.permissions import scoped_to_visible

from .models import DocumentationPage, Playlist, PlaylistItem, StepGuide


def playlists_visible_to_user(user) -> QuerySet[Playlist]:
    base = Playlist.objects.for_user(user).prefetch_related("items")
    return scoped_to_visible(
        base, user, owner_field="owner", content_type="playlist", public_visibility_value=Playlist.Visibility.PUBLIC
    )


def playlist_by_pk_for_user(user, pk) -> Playlist | None:
    return playlists_visible_to_user(user).filter(pk=pk).first()


def playlist_items_for_organization(organization_id) -> QuerySet[PlaylistItem]:
    return PlaylistItem.objects.filter(playlist__organization_id=organization_id)


def locked_playlist_items(playlist: Playlist) -> QuerySet[PlaylistItem]:
    """Row-locked within the caller's transaction, for concurrency-safe appends/reorders."""
    return PlaylistItem.objects.select_for_update().filter(playlist=playlist)


def documentation_pages_for_organization(organization_id) -> QuerySet[DocumentationPage]:
    return DocumentationPage.objects.filter(organization_id=organization_id).prefetch_related("clip_items")


def step_guides_for_organization(organization_id) -> QuerySet[StepGuide]:
    return StepGuide.objects.filter(clip__organization_id=organization_id)
