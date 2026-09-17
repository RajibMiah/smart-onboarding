"""
File Introduction:
Module: core.serializers
Role: Schema validation and payload formatting for identity/organization resources.

Responsibilities:
- Validates and shapes Organization, Department, Team, CustomRole, and User payloads.
- Formats membership/role display data and JWT claim payloads for the frontend.
- Handles registration and workspace-invitation acceptance payload validation.
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils.text import slugify
from rest_framework import serializers

from .models import (
    ROLE_SCOPE_DESCRIPTIONS,
    CustomRole,
    Department,
    Organization,
    SystemRoleTier,
    Team,
    TeamMembership,
    WorkspaceInvitation,
    WorkspaceMembership,
)

User = get_user_model()


class OrganizationSerializer(serializers.ModelSerializer):
    owner_email = serializers.CharField(source="owner.email", read_only=True, default=None)

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "slug",
            "domain",
            "logo_url",
            "tier",
            "owner",
            "owner_email",
            "settings",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "slug", "tier", "owner", "created_at", "updated_at"]

    def validate_settings(self, value: dict) -> dict:
        if not isinstance(value, dict):
            raise serializers.ValidationError("settings must be an object.")
        allowed_keys = {"retention_days", "default_clip_visibility", "force_strict_theme", "accent_color"}
        unknown = set(value) - allowed_keys
        if unknown:
            raise serializers.ValidationError(f"Unknown settings keys: {', '.join(sorted(unknown))}.")
        if "default_clip_visibility" in value and value["default_clip_visibility"] not in ("draft", "published"):
            raise serializers.ValidationError("default_clip_visibility must be 'draft' or 'published'.")
        return value


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "organization", "name", "description", "created_at"]
        read_only_fields = ["id", "organization", "created_at"]


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ["id", "organization", "department", "name", "created_at"]
        read_only_fields = ["id", "organization", "created_at"]


class CustomRoleSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)

    class Meta:
        model = CustomRole
        fields = [
            "id",
            "organization",
            "name",
            "description",
            "created_by",
            "department",
            "department_name",
            *CustomRole.CAPABILITY_FLAGS,
            "created_at",
        ]
        read_only_fields = ["id", "organization", "created_by", "created_at"]

    def validate_department(self, value: Department | None) -> Department | None:
        if value is not None and value.organization_id != self.context["request"].user.organization_id:
            raise serializers.ValidationError("That department doesn't belong to your workspace.")
        return value


class WorkspaceMembershipSerializer(serializers.ModelSerializer):
    custom_role_name = serializers.CharField(source="custom_role.name", read_only=True, default=None)
    role_display = serializers.SerializerMethodField()
    role_description = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    team = serializers.SerializerMethodField()

    class Meta:
        model = WorkspaceMembership
        fields = [
            "is_authorized",
            "is_creator",
            "is_global_admin",
            "is_content_manager",
            "tags",
            "role_tier",
            "role_display",
            "role_description",
            "custom_role",
            "custom_role_name",
            "department",
            "team",
            "revoked_at",
        ]

    def get_role_display(self, obj: WorkspaceMembership) -> str:
        if obj.role_tier == SystemRoleTier.CUSTOM and obj.custom_role_id:
            return obj.custom_role.name
        return SystemRoleTier(obj.role_tier).label

    def get_role_description(self, obj: WorkspaceMembership) -> str:
        """'[Role Name] - [scope]', e.g. 'Creator - you can create, see and share content'."""
        scope = obj.custom_role.description if obj.role_tier == SystemRoleTier.CUSTOM and obj.custom_role_id else None
        scope = scope or ROLE_SCOPE_DESCRIPTIONS.get(obj.role_tier, "")
        return f"{self.get_role_display(obj)} - {scope}" if scope else self.get_role_display(obj)

    def _team_membership(self, obj: WorkspaceMembership) -> TeamMembership | None:
        return TeamMembership.objects.filter(user_id=obj.user_id).select_related("team__department").first()

    def get_department(self, obj: WorkspaceMembership) -> dict | None:
        membership = self._team_membership(obj)
        department = membership.team.department if membership and membership.team.department_id else None
        return {"id": str(department.id), "name": department.name} if department else None

    def get_team(self, obj: WorkspaceMembership) -> dict | None:
        membership = self._team_membership(obj)
        return {"id": str(membership.team.id), "name": membership.team.name} if membership else None


class MemberRoleUpdateSerializer(serializers.Serializer):
    """PATCH payload for /users/<id>/role/ — role_tier and/or custom_role, either may be omitted."""

    role_tier = serializers.ChoiceField(choices=SystemRoleTier.choices, required=False)
    custom_role = serializers.PrimaryKeyRelatedField(
        queryset=CustomRole.objects.all(), required=False, allow_null=True
    )

    def validate_custom_role(self, value: CustomRole | None) -> CustomRole | None:
        if value is not None and value.organization_id != self.context["request"].user.organization_id:
            raise serializers.ValidationError("That custom role doesn't belong to your workspace.")
        return value


class UserSerializer(serializers.ModelSerializer):
    membership = WorkspaceMembershipSerializer(read_only=True)
    full_name = serializers.CharField(read_only=True)
    avatar_url = serializers.SerializerMethodField()
    workspace = serializers.SerializerMethodField()

    team_id = serializers.PrimaryKeyRelatedField(
        source="team", queryset=Team.objects.all(), required=False, allow_null=True, write_only=True
    )

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "avatar_url",
            "location",
            "language",
            "organization",
            "workspace",
            "is_active",
            "membership",
            "team_id",
            "created_at",
        ]
        read_only_fields = ["id", "email", "organization", "is_active", "created_at"]

    def get_avatar_url(self, obj: User) -> str:
        if obj.avatar:
            request = self.context.get("request")
            return request.build_absolute_uri(obj.avatar.url) if request else obj.avatar.url
        return obj.avatar_url

    def get_workspace(self, obj: User) -> dict | None:
        if not obj.organization_id:
            return None
        return {"id": str(obj.organization_id), "name": obj.organization.name, "slug": obj.organization.slug}

    def validate_team_id(self, value: Team | None) -> Team | None:
        if value is not None and value.organization_id != self.context["request"].user.organization_id:
            raise serializers.ValidationError("That team doesn't belong to your workspace.")
        return value

    def update(self, instance: User, validated_data: dict) -> User:
        team = validated_data.pop("team", "unset") if "team" in validated_data else "unset"
        instance = super().update(instance, validated_data)
        if team != "unset":
            TeamMembership.objects.filter(user=instance).delete()
            if team is not None:
                TeamMembership.objects.create(team=team, user=instance)
        return instance


class AvatarUploadSerializer(serializers.Serializer):
    avatar = serializers.ImageField()


class RegisterSerializer(serializers.ModelSerializer):
    """Signs up a user and provisions a brand-new organization for them as its Creator."""

    password = serializers.CharField(write_only=True, validators=[validate_password])
    organization_name = serializers.CharField(write_only=True, max_length=150)

    class Meta:
        model = User
        fields = ["email", "password", "first_name", "last_name", "organization_name"]

    def validate_organization_name(self, value: str) -> str:
        if Organization.objects.filter(slug=slugify(value)).exists():
            raise serializers.ValidationError("An organization with this name already exists.")
        return value

    def create(self, validated_data: dict) -> User:
        organization_name = validated_data.pop("organization_name")
        password = validated_data.pop("password")

        organization = Organization.objects.create(name=organization_name, slug=slugify(organization_name))

        user = User(organization=organization, **validated_data)
        user.set_password(password)
        user.save()

        organization.owner = user
        organization.save(update_fields=["owner"])

        WorkspaceMembership.objects.create(
            user=user, organization=organization, is_creator=True, is_global_admin=True
        )
        return user


class OrgMemberSerializer(serializers.ModelSerializer):
    """A workspace member row for the Manage Users table."""

    membership = WorkspaceMembershipSerializer(read_only=True)
    full_name = serializers.CharField(read_only=True)
    team = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "avatar_url", "membership", "team", "department", "created_at"]

    def get_team(self, obj: User) -> str | None:
        membership = obj.team_memberships.select_related("team").first()
        return membership.team.name if membership else None

    def get_department(self, obj: User) -> str | None:
        membership = obj.team_memberships.select_related("team__department").first()
        return membership.team.department.name if membership and membership.team.department else None


class WorkspaceInvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkspaceInvitation
        fields = [
            "id",
            "organization",
            "invited_by",
            "email",
            "department",
            "team",
            "tags",
            "is_authorized",
            "is_creator",
            "is_global_admin",
            "is_content_manager",
            "status",
            "created_at",
            "expires_at",
        ]
        read_only_fields = ["id", "organization", "invited_by", "status", "created_at", "expires_at"]

    def validate_email(self, value: str) -> str:
        value = value.strip().lower()
        organization = self.context["request"].user.organization
        if User.objects.filter(organization=organization, email__iexact=value).exists():
            raise serializers.ValidationError("This email is already a member of your workspace.")
        if WorkspaceInvitation.objects.filter(
            organization=organization, email__iexact=value, status=WorkspaceInvitation.Status.PENDING
        ).exists():
            raise serializers.ValidationError("There's already a pending invitation for this email.")
        return value

    def validate(self, attrs: dict) -> dict:
        organization = self.context["request"].user.organization
        for field in ("department", "team"):
            value = attrs.get(field)
            if value is not None and value.organization_id != organization.id:
                raise serializers.ValidationError({field: "Must belong to your own organization."})
        return attrs


class VerifyInvitationSerializer(serializers.Serializer):
    """Read-only shape for GET /invitations/verify/?token=... — not tied to a model instance."""

    email = serializers.EmailField()
    organization_name = serializers.CharField()
    is_creator = serializers.BooleanField()
    is_global_admin = serializers.BooleanField()
    is_content_manager = serializers.BooleanField()


class AcceptInvitationSerializer(serializers.Serializer):
    """Completes registration from a WorkspaceInvitation token."""

    token = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=80)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=80)
    password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate_token(self, value: str) -> WorkspaceInvitation:
        invitation = WorkspaceInvitation.objects.select_related("organization", "team").filter(token=value).first()
        if invitation is None or not invitation.is_redeemable():
            raise serializers.ValidationError("This invitation link is invalid or has expired.")
        return invitation

    def save(self) -> User:
        invitation: WorkspaceInvitation = self.validated_data["token"]
        password = self.validated_data["password"]

        user = User(
            organization=invitation.organization,
            email=invitation.email,
            first_name=self.validated_data.get("first_name", ""),
            last_name=self.validated_data.get("last_name", ""),
        )
        user.set_password(password)
        user.save()

        flags = invitation.membership_flags()
        WorkspaceMembership.objects.create(user=user, organization=invitation.organization, **flags)

        if invitation.team is not None:
            TeamMembership.objects.create(team=invitation.team, user=user)

        invitation.status = WorkspaceInvitation.Status.ACCEPTED
        invitation.save(update_fields=["status"])

        return user


