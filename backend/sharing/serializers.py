from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from collaboration.models import Playlist
from core.models import Department, Team, User
from core.permissions import user_has_share_capability
from media.models import Clip

from .models import MediaShareRequest, Notification, SharedContent


def resolve_shared_content(content_type: str, object_id, organization_id) -> Clip | Playlist | None:
    model = Clip if content_type == MediaShareRequest.ContentType.CLIP else Playlist
    return model.objects.filter(pk=object_id, organization_id=organization_id).first()


def content_thumbnail_url(target: Clip | Playlist | None, request) -> str:
    if not isinstance(target, Clip):
        return ""
    if target.thumbnail:
        return request.build_absolute_uri(target.thumbnail.url) if request else target.thumbnail.url
    return target.thumbnail_url


def can_manage_share(user, share: SharedContent) -> bool:
    """Whether `user` may edit this share's capability flags or revoke it —
    the row's own issuer, the root content's owner, a global admin, or
    anyone else `user_has_share_capability` already grants `can_reshare` to
    (a delegate who can invite further people can also manage the shares
    they already made). Used by both the serializer's read-only `can_manage`
    hint and the viewset's actual enforcement on PATCH/revoke.
    """
    if share.shared_by_id == user.id:
        return True
    membership = getattr(user, "membership", None)
    if membership and membership.is_global_admin:
        return True
    target = resolve_shared_content(share.content_type, share.object_id, share.organization_id)
    if target is None:
        return False
    owner_field = "author" if share.content_type == MediaShareRequest.ContentType.CLIP else "owner"
    if getattr(target, f"{owner_field}_id", None) == user.id:
        return True
    return user_has_share_capability(user, target, owner_field=owner_field, content_type=share.content_type, capability="can_reshare")


def validate_share_target_and_content(attrs: dict, organization, user) -> None:
    """Shared validation for anything shaped like {content_type, object_id, target_user/team/department}.

    Also enforces who may create the share/request in the first place: the
    content's own owner, a global admin, or someone already holding an
    active `can_reshare` grant on it via an existing `SharedContent` row.
    Without this, any workspace member could POST a share targeting a clip
    or playlist they'd never even been granted view access to — including a
    view-only recipient fanning a private share out to people the original
    owner never approved.
    """
    if not (attrs.get("target_user") or attrs.get("target_team") or attrs.get("target_department")):
        raise serializers.ValidationError("Must target a user, team, or department.")

    content_type = attrs.get("content_type")
    object_id = attrs.get("object_id")
    if content_type is not None and object_id is not None:
        model = Clip if content_type == MediaShareRequest.ContentType.CLIP else Playlist
        target = model.objects.filter(pk=object_id, organization=organization).first()
        if target is None:
            raise serializers.ValidationError("That clip or playlist doesn't exist in your workspace.")

        owner_field = "author" if content_type == MediaShareRequest.ContentType.CLIP else "owner"
        if not user_has_share_capability(
            user, target, owner_field=owner_field, content_type=content_type, capability="can_reshare"
        ):
            raise PermissionDenied("You don't have permission to share this content further.")

    for field_name in ("target_user", "target_team", "target_department"):
        value = attrs.get(field_name)
        if value is not None and value.organization_id != organization.id:
            raise serializers.ValidationError(f"{field_name} must belong to your workspace.")


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
        target = resolve_shared_content(obj.content_type, obj.object_id, obj.organization_id)
        return target.title if target else ""

    def get_content_thumbnail_url(self, obj: MediaShareRequest) -> str:
        target = resolve_shared_content(obj.content_type, obj.object_id, obj.organization_id)
        return content_thumbnail_url(target, self.context.get("request"))

    def validate(self, attrs: dict) -> dict:
        validate_share_target_and_content(attrs, self.context["request"].user.organization, self.context["request"].user)
        return attrs


class RequestActionSerializer(serializers.Serializer):
    ACTION_STATUS_MAP = {
        "approve": MediaShareRequest.Status.APPROVED,
        "request_changes": MediaShareRequest.Status.CHANGES_REQUESTED,
        "complete": MediaShareRequest.Status.COMPLETED,
    }

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
        target = resolve_shared_content(obj.content_type, obj.object_id, obj.organization_id)
        return target.title if target else ""

    def get_content_thumbnail_url(self, obj: SharedContent) -> str:
        target = resolve_shared_content(obj.content_type, obj.object_id, obj.organization_id)
        return content_thumbnail_url(target, self.context.get("request"))

    def get_can_manage(self, obj: SharedContent) -> bool:
        """Whether the requesting user may edit this row's flags or revoke it
        — its issuer, the root content owner, or an admin. Lets the
        dashboard disable controls it can't actually use, without
        re-deriving this same ownership lookup client-side."""
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return can_manage_share(request.user, obj)

    def validate(self, attrs: dict) -> dict:
        validate_share_target_and_content(attrs, self.context["request"].user.organization, self.context["request"].user)
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
