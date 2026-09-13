"""Identity & organization domain: users, workspaces, departments, teams.

Maps to APC_ORGANIZATIONS, APC_USERS, APC_DEPARTMENTS, APC_TEAMS and
APC_TEAM_MEMBERS in the ER diagram. Role flags (Creator / Content Manager /
Global Admin) live on WorkspaceMembership rather than on the ERD's plain
`is_staff` column, since permission checks need three independent flags.
"""

import secrets
import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    """Abstract base adding created_at/updated_at, mirrored on every APC table."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


def default_workspace_settings() -> dict:
    return {
        "retention_days": None,  # None = keep indefinitely
        "default_clip_visibility": "draft",
        "force_strict_theme": True,
        "accent_color": "#FFD200",
    }


class Organization(TimeStampedModel):
    """A workspace / tenant. Users, clips, playlists and pages are scoped to one."""

    class Tier(models.TextChoices):
        FREE = "free", "Free"
        PRO = "pro", "Pro"
        ENTERPRISE = "enterprise", "Enterprise"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=150, unique=True)
    domain = models.CharField(max_length=150, blank=True)
    logo_url = models.URLField(blank=True)
    tier = models.CharField(max_length=20, choices=Tier.choices, default=Tier.FREE)
    owner = models.ForeignKey(
        "core.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="owned_organizations",
    )
    # Branding/retention/default-visibility preferences — grouped as one JSON
    # blob (same pattern as Clip.filter_settings) rather than several columns
    # for what's fundamentally one cohesive "workspace preferences" concept.
    settings = models.JSONField(default=default_workspace_settings, blank=True)

    class Meta:
        db_table = "apc_organizations"
        ordering = ["name"]
        indexes = [models.Index(fields=["slug"])]

    def __str__(self) -> str:
        return self.name


class UserManager(BaseUserManager):
    """Email-based user manager (no username field)."""

    use_in_migrations = True

    def _create_user(self, email: str, password: str | None, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, TimeStampedModel):
    """Custom user, authenticated by email. `is_staff` here means Django admin access."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="users", null=True, blank=True
    )
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=80, blank=True)
    last_name = models.CharField(max_length=80, blank=True)
    # `avatar` (an uploaded file) takes priority over `avatar_url` (an
    # external URL) — same fallback pattern as Clip.thumbnail/thumbnail_url.
    avatar = models.ImageField(upload_to="avatars/%Y/%m/%d/", blank=True, null=True)
    avatar_url = models.URLField(blank=True)
    location = models.CharField(max_length=150, blank=True)
    language = models.CharField(max_length=10, default="en-US")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        db_table = "apc_users"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["organization", "is_active"])]

    def __str__(self) -> str:
        return self.email

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


class SystemRoleTier(models.TextChoices):
    """A richer role label layered on top of the existing is_creator/is_global_admin/
    is_content_manager flags — additive, not a replacement. Those three booleans stay
    the source of truth for every existing permission check in this codebase (they're
    baked into HasRolePermission usages, the JWT claims, and the invitation flow); this
    enum only classifies roles that don't fit them, namely HR_MANAGER and CUSTOM.
    OWNER/GLOBAL_ADMIN/CREATOR/VIEWER here are informational — assigning HR_MANAGER or
    CUSTOM deliberately does NOT touch is_global_admin, which is exactly what keeps an
    HR Manager or a custom role out of admin-gated endpoints without extra plumbing.
    """

    OWNER = "owner", "Workspace Owner"
    GLOBAL_ADMIN = "global_admin", "Global Administrator"
    HR_MANAGER = "hr_manager", "HR Manager"
    PROJECT_MANAGER = "project_manager", "Project Manager"
    TEAM_LEAD = "team_lead", "Team Lead"
    CREATOR = "creator", "Creator"
    VIEWER = "viewer", "Viewer"
    CUSTOM = "custom", "Custom Defined Role"


# The HR Manager tier's fixed capability set (see SystemRoleTier's docstring —
# this tier is informational/additive, so its allowed flags are hardcoded here
# rather than modeled as a CustomRole row).
HR_MANAGER_CAPABILITIES = frozenset(
    {"can_invite_users", "can_manage_teams", "can_manage_departments", "can_view_analytics", "can_revoke_access"}
)

# One human-readable scope sentence per tier, for the "My Account" role
# banner ("[Role Name] - [scope]"). Kept here (not hardcoded in the
# frontend) so it stays in sync with whatever HR_MANAGER_CAPABILITIES etc.
# actually grant.
ROLE_SCOPE_DESCRIPTIONS: dict[str, str] = {
    SystemRoleTier.OWNER: "you have full control over the workspace, billing, and content",
    SystemRoleTier.GLOBAL_ADMIN: "you can manage every user, role, and setting in this workspace",
    SystemRoleTier.HR_MANAGER: "you can invite users, manage the workforce, and view audit logs",
    SystemRoleTier.PROJECT_MANAGER: "you can curate content and manage teams in your department",
    SystemRoleTier.TEAM_LEAD: "you can review clips and manage invites for your team",
    SystemRoleTier.CREATOR: "you can create, see, and share content",
    SystemRoleTier.VIEWER: "you have read-only access to shared content",
    SystemRoleTier.CUSTOM: "your access is defined by a custom role",
}


class CustomRole(TimeStampedModel):
    """An admin-defined job role with a specific set of granular capability flags."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="custom_roles")
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    # Optional: this role's authority only applies within one department.
    # String reference: Department is defined later in this file.
    department = models.ForeignKey(
        "core.Department", on_delete=models.SET_NULL, null=True, blank=True, related_name="scoped_custom_roles"
    )

    can_invite_users = models.BooleanField(default=False)
    can_manage_departments = models.BooleanField(default=False)
    can_manage_teams = models.BooleanField(default=False)
    can_assign_roles = models.BooleanField(default=False)
    can_publish_public_clips = models.BooleanField(default=False)
    can_manage_playlists = models.BooleanField(default=False)
    can_approve_requests = models.BooleanField(default=False)
    can_view_analytics = models.BooleanField(default=False)
    can_revoke_access = models.BooleanField(default=False)

    class Meta:
        db_table = "apc_custom_roles"
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["organization", "name"], name="uniq_custom_role_per_org")]

    def __str__(self) -> str:
        return f"{self.name} ({self.organization.name})"

    CAPABILITY_FLAGS = (
        "can_invite_users",
        "can_manage_departments",
        "can_manage_teams",
        "can_assign_roles",
        "can_publish_public_clips",
        "can_manage_playlists",
        "can_approve_requests",
        "can_view_analytics",
        "can_revoke_access",
    )


class WorkspaceMembership(TimeStampedModel):
    """Per-organization role flags for a user, used by HasRolePermission."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="membership")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="memberships")
    is_authorized = models.BooleanField(default=True, help_text="Platform access. False effectively suspends the user.")
    is_creator = models.BooleanField(default=False)
    is_global_admin = models.BooleanField(default=False)
    is_content_manager = models.BooleanField(default=False)
    tags = models.JSONField(default=list, blank=True, help_text="Free-form organizational tags, e.g. 'Engineering'.")

    # Richer role classification, additive on top of the booleans above (see
    # SystemRoleTier's docstring).
    role_tier = models.CharField(max_length=30, choices=SystemRoleTier.choices, default=SystemRoleTier.CREATOR)
    custom_role = models.ForeignKey(
        CustomRole, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_members"
    )

    # Revocation — reuses `is_authorized` as the single active/suspended flag
    # (it already existed with exactly this intent) rather than adding a
    # second, potentially-conflicting status field.
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="revoked_memberships"
    )

    class Meta:
        db_table = "apc_workspace_memberships"
        indexes = [models.Index(fields=["organization"])]

    def __str__(self) -> str:
        return f"{self.user.email} @ {self.organization.name}"

    def has_permission(self, capability_flag: str) -> bool:
        """Dynamic capability check: role_tier/custom_role flags, gated on is_authorized."""
        if not self.is_authorized:
            return False
        if self.is_global_admin or self.role_tier in (SystemRoleTier.OWNER, SystemRoleTier.GLOBAL_ADMIN):
            return True
        if self.role_tier == SystemRoleTier.HR_MANAGER and capability_flag in HR_MANAGER_CAPABILITIES:
            return True
        if self.custom_role_id and capability_flag in CustomRole.CAPABILITY_FLAGS:
            return getattr(self.custom_role, capability_flag, False)
        return False


class Department(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="departments")
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "apc_departments"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["organization", "name"], name="uniq_department_per_org"),
        ]

    def __str__(self) -> str:
        return self.name


class Team(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="teams")
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, related_name="teams", null=True, blank=True
    )
    name = models.CharField(max_length=100)

    class Meta:
        db_table = "apc_teams"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class TeamMembership(models.Model):
    class Role(models.TextChoices):
        MEMBER = "member", "Member"
        EDITOR = "editor", "Editor"
        LEAD = "lead", "Lead"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="team_memberships")
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "apc_team_members"
        constraints = [
            models.UniqueConstraint(fields=["team", "user"], name="uniq_team_membership"),
        ]

    def __str__(self) -> str:
        return f"{self.user.email} in {self.team.name}"


def generate_invitation_token() -> str:
    return secrets.token_urlsafe(48)


def default_invitation_expiry():
    return timezone.now() + timezone.timedelta(days=7)


class WorkspaceInvitation(TimeStampedModel):
    """An admin-issued, email-targeted, single-use invitation to join a specific organization."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        EXPIRED = "expired", "Expired"
        REVOKED = "revoked", "Revoked"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="invitations")
    invited_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="sent_invitations")
    email = models.EmailField(db_index=True)
    token = models.CharField(max_length=128, unique=True, default=generate_invitation_token, editable=False)

    # Organizational assignment, applied to the WorkspaceMembership/TeamMembership on accept.
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True)
    tags = models.JSONField(default=list, blank=True)

    # Permission flags, copied onto the new WorkspaceMembership on accept.
    is_authorized = models.BooleanField(default=True)
    is_creator = models.BooleanField(default=True)
    is_global_admin = models.BooleanField(default=False)
    is_content_manager = models.BooleanField(default=False)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    expires_at = models.DateTimeField(default=default_invitation_expiry)

    class Meta:
        db_table = "apc_workspace_invitations"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["organization", "email", "status"], name="uniq_pending_invite_per_email"),
        ]
        indexes = [models.Index(fields=["token"]), models.Index(fields=["organization", "email"])]

    def __str__(self) -> str:
        return f"Invitation for {self.email} to {self.organization.name}"

    def is_redeemable(self) -> bool:
        return self.status == self.Status.PENDING and self.expires_at > timezone.now()

    def membership_flags(self) -> dict[str, bool]:
        return {
            "is_authorized": self.is_authorized,
            "is_creator": self.is_creator,
            "is_global_admin": self.is_global_admin,
            "is_content_manager": self.is_content_manager,
            "tags": self.tags,
        }
