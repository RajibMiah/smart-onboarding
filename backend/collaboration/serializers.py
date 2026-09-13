from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator

from .models import DocumentationPage, PageClipItem, Playlist, PlaylistItem, StepGuide


class PlaylistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlaylistItem
        fields = ["id", "playlist", "clip", "position", "added_at"]
        # `position` is server-assigned in `PlaylistItemViewSet.perform_create`
        # (always appends after the current max) — a client-supplied value
        # could collide with the (playlist, position) unique constraint.
        read_only_fields = ["id", "position", "added_at"]
        # DRF auto-generates a unique-together validator per model
        # UniqueConstraint, including (playlist, position) — but since
        # `position` is read-only, it would validate against the model
        # field's `default=0` before `perform_create` ever computes the real
        # value, rejecting every playlist's second item as a false-positive
        # collision with its first (both "true" position 0 at validation
        # time). Declaring validators explicitly keeps the one that's safe to
        # check up front (playlist+clip) and drops the other — the DB-level
        # UniqueConstraint still backstops position uniqueness for real.
        validators = [
            UniqueTogetherValidator(
                queryset=PlaylistItem.objects.all(),
                fields=["playlist", "clip"],
                message="This clip is already in that playlist.",
            )
        ]


class PlaylistSerializer(serializers.ModelSerializer):
    items = PlaylistItemSerializer(many=True, read_only=True)

    class Meta:
        model = Playlist
        fields = [
            "id",
            "organization",
            "owner",
            "title",
            "description",
            "cover_image_url",
            "visibility",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "organization", "owner", "created_at", "updated_at"]


class StepGuideSerializer(serializers.ModelSerializer):
    class Meta:
        model = StepGuide
        fields = [
            "id",
            "clip",
            "step_number",
            "timestamp_seconds",
            "title",
            "description_markdown",
            "snapshot_image_url",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class PageClipItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PageClipItem
        fields = ["id", "page", "clip", "step_number", "step_note"]
        read_only_fields = ["id"]


class DocumentationPageSerializer(serializers.ModelSerializer):
    clip_items = PageClipItemSerializer(many=True, read_only=True)

    class Meta:
        model = DocumentationPage
        fields = [
            "id",
            "organization",
            "author",
            "title",
            "slug",
            "content_markdown",
            "section_count",
            "status",
            "visibility",
            "clip_items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "organization", "author", "created_at", "updated_at"]
