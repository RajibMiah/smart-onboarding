"""
File Introduction:
Module: collaboration.services.handlers
Role: Domain services for playlist sequencing rules and concurrency-safe item writes.

Responsibilities:
- Evaluates who may reorder a playlist's clip sequence.
- Applies atomic, collision-free reordering and appends to playlist items.
"""

from __future__ import annotations

from django.db import transaction
from rest_framework.exceptions import ValidationError

from core.models import SystemRoleTier
from core.permissions import user_has_share_capability

from .. import selectors
from ..models import Playlist, PlaylistItem


def can_manage_playlist_sequence(user, playlist: Playlist) -> bool:
    """Whether `user` may reorder `playlist`: the owner, a global admin, an
    active `can_reorder` share grant, or a Creator/Content Manager/Team Lead."""
    if user_has_share_capability(
        user, playlist, owner_field="owner", content_type="playlist", capability="can_reorder"
    ):
        return True
    membership = getattr(user, "membership", None)
    if membership is None:
        return False
    if membership.is_creator or membership.is_content_manager:
        return True
    return membership.role_tier == SystemRoleTier.TEAM_LEAD


class PlaylistService:
    @staticmethod
    def reorder(playlist: Playlist, ordered_clip_ids) -> Playlist:
        if not isinstance(ordered_clip_ids, list) or not ordered_clip_ids:
            raise ValidationError("ordered_clip_ids must be a non-empty list of clip ids.")

        items = list(playlist.items.all())
        items_by_clip_id = {str(item.clip_id): item for item in items}
        if set(items_by_clip_id) != {str(clip_id) for clip_id in ordered_clip_ids}:
            raise ValidationError(
                "ordered_clip_ids must include exactly this playlist's current clips, no more and no fewer."
            )

        with transaction.atomic():
            # Two-phase write avoids a mid-loop unique-constraint collision
            # on (playlist, position).
            for offset, item in enumerate(items):
                PlaylistItem.objects.filter(pk=item.pk).update(position=10_000 + offset)
            for index, clip_id in enumerate(ordered_clip_ids):
                PlaylistItem.objects.filter(pk=items_by_clip_id[str(clip_id)].pk).update(position=index)

        playlist.refresh_from_db()
        return playlist


class PlaylistItemService:
    @staticmethod
    def append(serializer) -> PlaylistItem:
        """Assigns the next position after this playlist's current last item."""
        playlist = serializer.validated_data["playlist"]
        with transaction.atomic():
            existing = selectors.locked_playlist_items(playlist)
            max_position = existing.order_by("-position").values_list("position", flat=True).first()
            next_position = 0 if max_position is None else max_position + 1
            return serializer.save(position=next_position)
