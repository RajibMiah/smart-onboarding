from rest_framework import serializers

from .models import Clip, MediaAsset


class MediaAssetSerializer(serializers.ModelSerializer):
    """`file` (write-only, multipart) is the real upload; `file_url` is always
    the resolved, absolute location to play it back from — whether that came
    from an uploaded file or an external URL."""

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

    def create(self, validated_data: dict) -> MediaAsset:
        uploaded = validated_data.pop("file", None)
        if uploaded is not None:
            validated_data["file"] = uploaded
            validated_data.setdefault("mime_type", uploaded.content_type or "")
            validated_data.setdefault("file_size_bytes", uploaded.size)
            validated_data.setdefault("status", MediaAsset.Status.READY)
        return super().create(validated_data)


class ClipSerializer(serializers.ModelSerializer):
    assets = MediaAssetSerializer(many=True, read_only=True)
    thumbnail = serializers.ImageField(write_only=True, required=False, allow_null=True)
    thumbnail_url = serializers.SerializerMethodField()

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
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "organization", "author", "created_at", "updated_at"]

    def get_thumbnail_url(self, obj: Clip) -> str:
        if obj.thumbnail:
            request = self.context.get("request")
            return request.build_absolute_uri(obj.thumbnail.url) if request else obj.thumbnail.url
        return obj.thumbnail_url

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
