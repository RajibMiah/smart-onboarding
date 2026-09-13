"""Reusable DRF permission classes shared by every domain app's viewsets."""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Organization


class IsWorkspaceMember(BasePermission):
    """Authenticated users may only touch objects in their own organization.

    Also enforces `WorkspaceMembership.is_authorized` — this flag already
    existed with "False suspends the user" as its documented intent, but
    nothing actually checked it, so a revoked member's still-valid access
    token kept working normally until it expired on its own. Since this
    class gates nearly every viewset in the app, checking it here is what
    makes a revocation take effect on the very next request rather than
    only once the user's session naturally expires.
    """

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not (user and user.is_authenticated and user.organization_id):
            return False
        membership = getattr(user, "membership", None)
        return membership is None or membership.is_authorized

    def has_object_permission(self, request, view, obj) -> bool:
        # An Organization *is* the workspace — it has no `organization` FK of
        # its own, so the generic lookup below (written for objects that
        # belong to one, like Clip/Playlist/TimelineTrack) always resolved to
        # None and silently failed every object-level check on it. Invisible
        # until now since nothing previously called retrieve/update/destroy
        # on a single Organization (only the list endpoint, which skips
        # object-level permission checks entirely).
        if isinstance(obj, Organization):
            return obj.id == request.user.organization_id

        organization_id = getattr(obj, "organization_id", None)
        for related in ("clip", "track", "playlist", "page"):
            if organization_id is not None:
                break
            parent = getattr(obj, related, None)
            organization_id = getattr(parent, "organization_id", None) if parent else None

        return organization_id == request.user.organization_id


class HasRolePermission(BasePermission):
    """Require one of the given role flags on the user's WorkspaceMembership.

    Usage: set `required_roles = ("is_content_manager", "is_global_admin")`
    on the view, or subclass with `required_roles` set on the class.
    """

    required_roles: tuple[str, ...] = ()

    def has_permission(self, request, view) -> bool:
        required_roles = getattr(view, "required_roles", self.required_roles)
        if not required_roles:
            return True

        user = request.user
        if not (user and user.is_authenticated):
            return False

        membership = getattr(user, "membership", None)
        if membership is None:
            return False

        return any(getattr(membership, role, False) for role in required_roles)


class HasCapability(BasePermission):
    """Dynamic capability check via `WorkspaceMembership.has_permission(flag)`.

    Usage: set `required_capability = "can_invite_users"` on the view. Unlike
    `HasRolePermission` (which only ever checks the three hardcoded legacy
    booleans), this also accounts for the HR Manager tier and any CustomRole
    flags, via the model method that already encodes that logic.
    """

    required_capability: str | None = None

    def has_permission(self, request, view) -> bool:
        capability = getattr(view, "required_capability", self.required_capability)
        if not capability:
            return True

        user = request.user
        if not (user and user.is_authenticated):
            return False

        membership = getattr(user, "membership", None)
        return bool(membership and membership.has_permission(capability))


class IsProjectOwnerOrReadOnly(BasePermission):
    """Any workspace member may read; only the object's owner/author may write."""

    owner_fields: tuple[str, ...] = ("author", "owner", "user")

    def has_object_permission(self, request, view, obj) -> bool:
        if request.method in SAFE_METHODS:
            return True

        for field in self.owner_fields:
            if hasattr(obj, field):
                return getattr(obj, field) == request.user

        return False
