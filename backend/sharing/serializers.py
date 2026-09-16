"""
File Introduction:
Module: sharing.serializers
Role: Schema validation and payload formatting for shares, requests, and notifications.

Responsibilities:
- Validates and shapes MediaShareRequest, SharedContent, and Notification payloads.
- Formats read-only content title/thumbnail/can-manage fields via the selectors layer.
"""

from rest_framework import serializers

from . import selectors
from .models import MediaShareRequest, Notification, SharedContent
from .services.handlers import ACTION_STATUS_MAP, can_manage_share


def _require_target(attrs: dict) -> None:
    if not (attrs.get("target_user") or attrs.get("target_team") or attrs.get("target_department")):
        raise serializers.ValidationError("Must target a user, team, or department.")


class MediaShareRequestSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)
    target_user_name = serializers.CharField(source="target_user.full_name", read_only=True)
    target_team_name = serializers.CharField(source="target_team.name", read_only=True)
    target_department_name = serializers.CharField(source="target_department.name", read_only=True)
    content_title = serializers.SerializerMethodField()
    content_thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = MediaShareRequest
        fields = "__all__"
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
        target = selectors.resolve_shared_content(obj.content_type, obj.object_id, obj.organization_id)
        return target.title if target else ""

    def get_content_thumbnail_url(self, obj: MediaShareRequest) -> str:
        target = selectors.resolve_shared_content(obj.content_type, obj.object_id, obj.organization_id)
        return selectors.content_thumbnail_url(target, self.context.get("request"))

    def validate(self, attrs: dict) -> dict:
        _require_target(attrs)
        return attrs


class RequestActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=list(ACTION_STATUS_MAP.keys()))
    note = serializers.CharField(required=False, allow_blank=True, default="")


class SharedContentSerializer(serializers.ModelSerializer):
    shared_by_name = serializers.CharField(source="shared_by.full_name", read_only=True)
    shared_by_avatar_url = serializers.CharField(source="shared_by.avatar_url", read_only=True)
    target_user_name = serializers.CharField(source="target_user.full_name", read_only=True)
    target_team_name = serializers.CharField(source="target_team.name", read_only=True)
    target_department_name = serializers.CharField(source="target_department.name", read_only=True)
    revoked_by_name = serializers.CharField(source="revoked_by.full_name", read_only=True)
    content_title = serializers.SerializerMethodField()
    content_thumbnail_url = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()

    class Meta:
        model = SharedContent
        fields = [
            "id",
            "organization",
            "shared_by",
            "shared_by_name",
            "shared_by_avatar_url",
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
            "permission",
            "can_view",
            "can_edit",
            "can_reorder",
            "can_reshare",
            "parent_share",
            "is_active",
            "revoked_at",
            "revoked_by",
            "revoked_by_name",
            "can_manage",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "organization",
            "shared_by",
            "parent_share",
            "is_active",
            "revoked_at",
            "revoked_by",
            "created_at",
        ]

    def get_content_title(self, obj: SharedContent) -> str:
        target = selectors.resolve_shared_content(obj.content_type, obj.object_id, obj.organization_id)
        return target.title if target else ""

    def get_content_thumbnail_url(self, obj: SharedContent) -> str:
        target = selectors.resolve_shared_content(obj.content_type, obj.object_id, obj.organization_id)
        return selectors.content_thumbnail_url(target, self.context.get("request"))

    def get_can_manage(self, obj: SharedContent) -> bool:
        """Whether the requesting user may edit or revoke this share."""
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return can_manage_share(request.user, obj)

    def validate(self, attrs: dict) -> dict:
        _require_target(attrs)
        return attrs


class NotificationSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.full_name", read_only=True)
    sender_avatar_url = serializers.CharField(source="sender.avatar_url", read_only=True)

    class Meta:
        model = Notification
        fields = [
            "id",
            "sender",
            "sender_name",
            "sender_avatar_url",
            "notification_type",
            "title",
            "message",
            "action_url",
            "is_read",
            "created_at",
        ]
        read_only_fields = fields
