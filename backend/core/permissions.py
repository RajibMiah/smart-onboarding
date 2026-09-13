"""Reusable DRF permission classes shared by every domain app's viewsets."""

from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsWorkspaceMember(BasePermission):
    """Authenticated users may only touch objects in their own organization."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and user.organization_id)

    def has_object_permission(self, request, view, obj) -> bool:
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
