"""
File Introduction:
Module: core.permissions
Role: Cross-cutting authorization policy shared by every domain app's viewsets.

Responsibilities:
- Resolves ownership, sharing-grant, and visibility checks for any content type.
- Exposes reusable DRF `BasePermission` classes for workspace membership, role, and capability gating.
- Provides queryset-scoping helpers so viewsets can filter to what a user may see.
"""

from django.db.models import Q, QuerySet
from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Organization, Team, TeamMembership


def _users_team_and_department_ids(user) -> tuple[list, list]:
    team_ids = list(TeamMembership.objects.filter(user_id=user.id).values_list("team_id", flat=True))
    department_ids = list(
        Team.objects.filter(id__in=team_ids).exclude(department_id=None).values_list("department_id", flat=True)
    )
    return team_ids, department_ids


def user_has_share_capability(user, obj, *, owner_field: str, content_type: str, capability: str) -> bool:
    """Whether `user` holds `capability` on `obj` — its own creator, a global
    admin, or an active `SharedContent` grant with that capability set,
    directly or via their team/department."""
    if getattr(obj, f"{owner_field}_id", None) == user.id:
        return True

    membership = getattr(user, "membership", None)
    if membership and membership.is_global_admin:
        return True

    from sharing.models import SharedContent

    team_ids, department_ids = _users_team_and_department_ids(user)
    return SharedContent.objects.filter(
        content_type=content_type,
        object_id=obj.id,
        is_active=True,
        **{capability: True},
    ).filter(
        Q(target_user_id=user.id) | Q(target_team_id__in=team_ids) | Q(target_department_id__in=department_ids)
    ).exists()


def user_can_edit_object(user, obj, *, owner_field: str, content_type: str) -> bool:
    """Whether `user` may edit `obj`'s content, via ownership or a delegated `can_edit` grant."""
    return user_has_share_capability(user, obj, owner_field=owner_field, content_type=content_type, capability="can_edit")


def user_is_owner_or_admin(user, obj, *, owner_field: str) -> bool:
    """Whether `user` is `obj`'s own creator or a global admin — no sharing grant satisfies this."""
    if getattr(obj, f"{owner_field}_id", None) == user.id:
        return True
    membership = getattr(user, "membership", None)
    return bool(membership and membership.is_global_admin)


def user_can_view_object(user, obj, *, owner_field: str, content_type: str, public_visibility_value: str) -> bool:
    """Single-object counterpart to `visible_to_user_filter`: owner, global admin,
    workspace-public, or an active `can_view` share grant."""
    if getattr(obj, "visibility", None) == public_visibility_value:
        return True
    return user_has_share_capability(user, obj, owner_field=owner_field, content_type=content_type, capability="can_view")


def visible_to_user_filter(user, *, owner_field: str, content_type: str, public_visibility_value: str) -> Q:
    """Q filter for rows a user may see: their own, workspace-public, or
    explicitly shared with them via an active `can_view` grant. Callers still
    need their own base organization-scoping."""
    from sharing.models import SharedContent

    team_ids, department_ids = _users_team_and_department_ids(user)
    shared_object_ids = SharedContent.objects.filter(content_type=content_type, is_active=True, can_view=True).filter(
        Q(target_user_id=user.id) | Q(target_team_id__in=team_ids) | Q(target_department_id__in=department_ids)
    ).values_list("object_id", flat=True)

    return Q(**{owner_field: user}) | Q(visibility=public_visibility_value) | Q(id__in=shared_object_ids)


def scoped_to_visible(queryset: QuerySet, user, **kwargs) -> QuerySet:
    """`queryset` filtered to what `user` may see — unfiltered for a global
    admin, otherwise `visible_to_user_filter` applied."""
    membership = getattr(user, "membership", None)
    if membership and membership.is_global_admin:
        return queryset
    return queryset.filter(visible_to_user_filter(user, **kwargs)).distinct()


class IsWorkspaceMember(BasePermission):
    """Authenticated, organization-scoped access with a live `is_authorized` check."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not (user and user.is_authenticated and user.organization_id):
            return False
        membership = getattr(user, "membership", None)
        return membership is None or membership.is_authorized

    def has_object_permission(self, request, view, obj) -> bool:
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
    """Requires one of `required_roles` (WorkspaceMembership boolean flags) on the view."""

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
    """Requires `required_capability` via `WorkspaceMembership.has_permission`."""

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


class IsOwnerOrDelegatedEditor(BasePermission):
    """Gates writes only: delete stays owner/admin-exclusive, other writes
    (PATCH/PUT) are allowed for the owner, a global admin, or a delegated
    `can_edit` grant. Set `owner_field` and `content_type` on the view."""

    owner_field: str = "author"
    content_type: str = ""

    def has_object_permission(self, request, view, obj) -> bool:
        if request.method in SAFE_METHODS:
            return True

        owner_field = getattr(view, "owner_field", self.owner_field)
        if request.method == "DELETE":
            return user_is_owner_or_admin(request.user, obj, owner_field=owner_field)

        content_type = getattr(view, "content_type", self.content_type)
        return user_can_edit_object(request.user, obj, owner_field=owner_field, content_type=content_type)
