from rest_framework import serializers

from .models import DocumentationPage, PageClipItem, Playlist, PlaylistItem, StepGuide


class PlaylistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlaylistItem
        fields = ["id", "playlist", "clip", "position", "added_at"]
        read_only_fields = ["id", "added_at"]


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
