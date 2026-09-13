from rest_framework import serializers

from collaboration.models import Playlist
from core.models import Department, Team, User
from media.models import Clip

from .models import MediaShareRequest


class MediaShareRequestSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)
    target_user_name = serializers.CharField(source="target_user.full_name", read_only=True)
    target_team_name = serializers.CharField(source="target_team.name", read_only=True)
    target_department_name = serializers.CharField(source="target_department.name", read_only=True)
    content_title = serializers.SerializerMethodField()
    content_thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = MediaShareRequest
        fields = [
            "id",
            "organization",
            "created_by",
            "created_by_name",
            "content_type",
            "object_id",
            "content_title",
            "content_thumbnail_url",
            "target_user",
            "target_user_name",
            "target_team",
            "target_team_name",
            "target_department",
            "target_department_name",
            "request_type",
            "priority",
            "status",
            "message",
            "due_date",
            "resolved_by",
            "resolution_note",
            "resolved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "organization",
            "created_by",
            "status",
            "resolved_by",
            "resolution_note",
            "resolved_at",
            "created_at",
            "updated_at",
        ]

    def get_content_title(self, obj: MediaShareRequest) -> str:
        target = self._resolve_content(obj)
        return target.title if target else ""

    def get_content_thumbnail_url(self, obj: MediaShareRequest) -> str:
        target = self._resolve_content(obj)
        if not isinstance(target, Clip):
            return ""
        if target.thumbnail:
            request = self.context.get("request")
            return request.build_absolute_uri(target.thumbnail.url) if request else target.thumbnail.url
        return target.thumbnail_url

    def _resolve_content(self, obj: MediaShareRequest) -> Clip | Playlist | None:
        model = Clip if obj.content_type == MediaShareRequest.ContentType.CLIP else Playlist
        return model.objects.filter(pk=obj.object_id, organization_id=obj.organization_id).first()

    def validate(self, attrs: dict) -> dict:
        target_user = attrs.get("target_user")
        target_team = attrs.get("target_team")
        target_department = attrs.get("target_department")
        if not (target_user or target_team or target_department):
            raise serializers.ValidationError("A request must target a user, team, or department.")

        organization = self.context["request"].user.organization
        content_type = attrs.get("content_type")
        object_id = attrs.get("object_id")
        model = Clip if content_type == MediaShareRequest.ContentType.CLIP else Playlist
        if object_id is not None and not model.objects.filter(pk=object_id, organization=organization).exists():
            raise serializers.ValidationError("That clip or playlist doesn't exist in your workspace.")

        for field_name, model_cls in (("target_user", User), ("target_team", Team), ("target_department", Department)):
            value = attrs.get(field_name)
            if value is not None and value.organization_id != organization.id:
                raise serializers.ValidationError(f"{field_name} must belong to your workspace.")

        return attrs


class RequestActionSerializer(serializers.Serializer):
    ACTION_STATUS_MAP = {
        "approve": MediaShareRequest.Status.APPROVED,
        "request_changes": MediaShareRequest.Status.CHANGES_REQUESTED,
        "complete": MediaShareRequest.Status.COMPLETED,
    }

    action = serializers.ChoiceField(choices=list(ACTION_STATUS_MAP.keys()))
    note = serializers.CharField(required=False, allow_blank=True, default="")
