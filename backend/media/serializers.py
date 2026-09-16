"""
File Introduction:
Module: media.serializers
Role: Schema validation and payload formatting for clips and media assets.

Responsibilities:
- Validates and shapes Clip and MediaAsset payloads, including slug and filter_settings validation.
- Formats read-only URL, ownership, and playlist-count fields for the frontend.
"""

from rest_framework import serializers

from core.permissions import user_can_edit_object, user_is_owner_or_admin

from .models import Clip, MediaAsset


class MediaAssetSerializer(serializers.ModelSerializer):
    """`file` is the write-only upload; `file_url` resolves to the absolute
    playback location, whether uploaded or an external URL."""

    file = serializers.FileField(write_only=True, required=False)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = MediaAsset
        fields = [
            "id",
            "clip",
            "title",
            "asset_type",
            "file",
            "file_url",
            "mime_type",
            "file_size_bytes",
            "resolution",
            "width",
            "height",
            "duration",
            "framerate",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
        extra_kwargs = {"clip": {"required": False, "allow_null": True}}

    def get_file_url(self, obj: MediaAsset) -> str:
        if obj.file:
            request = self.context.get("request")
            return request.build_absolute_uri(obj.file.url) if request else obj.file.url
        return obj.file_url

    def validate_clip(self, value: Clip | None) -> Clip | None:
        if value is not None and value.organization_id != self.context["request"].user.organization_id:
            raise serializers.ValidationError("This clip doesn't belong to your workspace.")
        return value


class ClipSerializer(serializers.ModelSerializer):
    assets = MediaAssetSerializer(many=True, read_only=True)
    thumbnail = serializers.ImageField(write_only=True, required=False, allow_null=True)
    thumbnail_url = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    playlist_count = serializers.SerializerMethodField()

    class Meta:
        model = Clip
        fields = [
            "id",
            "organization",
            "author",
            "title",
            "slug",
            "description",
            "language",
            "duration_seconds",
            "thumbnail",
            "thumbnail_url",
            "status",
            "visibility",
            "filter_settings",
            "assets",
            "can_edit",
            "is_owner",
            "playlist_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "organization", "author", "created_at", "updated_at"]

    def get_thumbnail_url(self, obj: Clip) -> str:
        if obj.thumbnail:
            request = self.context.get("request")
            return request.build_absolute_uri(obj.thumbnail.url) if request else obj.thumbnail.url
        return obj.thumbnail_url

    def get_can_edit(self, obj: Clip) -> bool:
        """May edit this clip's content (cuts, filters, metadata)."""
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return user_can_edit_object(request.user, obj, owner_field="author", content_type="clip")

    def get_is_owner(self, obj: Clip) -> bool:
        """This clip's own creator or a global admin — gates delete/visibility changes."""
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return user_is_owner_or_admin(request.user, obj, owner_field="author")

    def get_playlist_count(self, obj: Clip) -> int:
        return obj.playlist_items.values("playlist_id").distinct().count()

    def validate_slug(self, value: str) -> str:
        organization = self.context["request"].user.organization
        queryset = Clip.objects.filter(organization=organization, slug=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A clip with this slug already exists in your workspace.")
        return value

    def validate_filter_settings(self, value: dict) -> dict:
        if not isinstance(value, dict):
            raise serializers.ValidationError("filter_settings must be an object.")
        allowed_keys = {"brightness", "contrast", "saturation", "volumeGain", "noiseSuppression"}
        unknown = set(value) - allowed_keys
        if unknown:
            raise serializers.ValidationError(f"Unknown filter_settings keys: {', '.join(sorted(unknown))}.")
        for key in ("brightness", "contrast", "saturation"):
            if key in value and not (0 <= float(value[key]) <= 200):
                raise serializers.ValidationError(f"{key} must be between 0 and 200.")
        if "volumeGain" in value and not (0 <= float(value["volumeGain"]) <= 2):
            raise serializers.ValidationError("volumeGain must be between 0 and 2.")
        if "noiseSuppression" in value and not isinstance(value["noiseSuppression"], bool):
            raise serializers.ValidationError("noiseSuppression must be a boolean.")
        return value
