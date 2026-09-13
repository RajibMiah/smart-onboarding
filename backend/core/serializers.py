from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils.text import slugify
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Department, Organization, Team, TeamMembership, WorkspaceInvitation, WorkspaceMembership

User = get_user_model()


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["id", "name", "slug", "domain", "logo_url", "tier", "created_at", "updated_at"]
        read_only_fields = ["id", "slug", "tier", "created_at", "updated_at"]


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


class WorkspaceMembershipSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkspaceMembership
        fields = ["is_authorized", "is_creator", "is_global_admin", "is_content_manager", "tags"]


class UserSerializer(serializers.ModelSerializer):
    membership = WorkspaceMembershipSerializer(read_only=True)
    full_name = serializers.CharField(read_only=True)

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
            "is_active",
            "membership",
            "created_at",
        ]
        read_only_fields = ["id", "email", "organization", "is_active", "created_at"]


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


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adds organization/role claims to the access token for cheap frontend gating."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["organization_id"] = str(user.organization_id) if user.organization_id else None
        membership = getattr(user, "membership", None)
        token["is_creator"] = bool(membership and membership.is_creator)
        token["is_global_admin"] = bool(membership and membership.is_global_admin)
        token["is_content_manager"] = bool(membership and membership.is_content_manager)
        return token
