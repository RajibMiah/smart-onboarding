"""Reusable DRF permission classes shared by every domain app's viewsets."""

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
    """Whether `user` holds `capability` ("can_view"/"can_edit"/"can_reorder"/
    "can_reshare") on `obj` — its own creator, a global admin, or an *active*
    `SharedContent` row (from the `sharing` app) with that specific boolean
    set, directly or via their team/department. A revoked share
    (`is_active=False`) never counts, regardless of what its booleans say —
    revocation is a soft-delete precisely so the row (and its place in the
    delegation chain) survives, not so it keeps granting access.
    `content_type` is the plain string a `SharedContent.content_type` row
    uses ("clip"/"playlist"), not an import of `sharing`'s enum — kept as a
    string so callers outside the sharing app don't need to import it.
    """
    if getattr(obj, f"{owner_field}_id", None) == user.id:
        return True

    membership = getattr(user, "membership", None)
    if membership and membership.is_global_admin:
        return True

    from sharing.models import SharedContent  # local import: avoids a hard core->sharing dependency at module load

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
    """Whether `user` may edit `obj`'s content — its own creator, a global
    admin, or a delegated `can_edit` `SharedContent` grant. Deliberately
    narrower than "may delete it or change its visibility": those two stay
    owner/admin-only (see `user_is_owner_or_admin`) even for a delegate
    trusted enough to edit — a can_edit invitee editing timeline cuts is a
    different trust level than them unilaterally deleting the clip or
    flipping it public.
    """
    return user_has_share_capability(user, obj, owner_field=owner_field, content_type=content_type, capability="can_edit")


def user_is_owner_or_admin(user, obj, *, owner_field: str) -> bool:
    """Whether `user` is `obj`'s own creator or a global admin — no sharing
    grant satisfies this, however broad. The gate for the handful of actions
    that stay owner-exclusive regardless of delegated edit rights: deleting
    the object and changing its visibility.
    """
    if getattr(obj, f"{owner_field}_id", None) == user.id:
        return True
    membership = getattr(user, "membership", None)
    return bool(membership and membership.is_global_admin)


def user_can_view_object(user, obj, *, owner_field: str, content_type: str, public_visibility_value: str) -> bool:
    """Single-object counterpart to `visible_to_user_filter`/`scoped_to_visible`
    — used where there's already one specific object in hand (e.g. resolving
    a raw media file back to the `Clip` that owns it) rather than a queryset
    to filter. Same rule: owner, global admin, workspace-public, or shared
    with an active `can_view` grant.
    """
    if getattr(obj, "visibility", None) == public_visibility_value:
        return True
    return user_has_share_capability(user, obj, owner_field=owner_field, content_type=content_type, capability="can_view")


def visible_to_user_filter(user, *, owner_field: str, content_type: str, public_visibility_value: str) -> Q:
    """Q filter for "rows this user may see": their own, workspace-public, or
    explicitly shared with them with an active `can_view` grant (directly, or
    via their team/department) — the private-by-default half of the
    ownership/privacy model. Callers still need their own base
    organization-scoping; this only adds the visibility/sharing dimension.
    """
    from sharing.models import SharedContent

    team_ids, department_ids = _users_team_and_department_ids(user)
    shared_object_ids = SharedContent.objects.filter(content_type=content_type, is_active=True, can_view=True).filter(
        Q(target_user_id=user.id) | Q(target_team_id__in=team_ids) | Q(target_department_id__in=department_ids)
    ).values_list("object_id", flat=True)

    return Q(**{owner_field: user}) | Q(visibility=public_visibility_value) | Q(id__in=shared_object_ids)


def scoped_to_visible(queryset: QuerySet, user, **kwargs) -> QuerySet:
    """`queryset` filtered to what `user` may see — the full, unfiltered
    queryset for a global admin (audit-level visibility), otherwise
    `visible_to_user_filter` applied. `**kwargs` forwards to that function.
    """
    membership = getattr(user, "membership", None)
    if membership and membership.is_global_admin:
        return queryset
    return queryset.filter(visible_to_user_filter(user, **kwargs)).distinct()


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


class IsOwnerOrDelegatedEditor(BasePermission):
    """Read access is governed entirely by the viewset's own `get_queryset()`
    scoping (private-by-default + sharing) — DRF never calls
    `has_object_permission` for `.list()`, only retrieve/update/destroy, so
    this only needs to gate writes.

    `DELETE` stays owner/admin-exclusive (`user_is_owner_or_admin`) — a
    delegate trusted to edit content isn't automatically trusted to delete
    it outright. Every other write (`PATCH`/`PUT`) is allowed for the
    object's own creator, a global admin, or anyone `user_can_edit_object`
    grants delegated edit rights to via a `SharedContent` row; the further
    "but not *this* field" restriction for changing `visibility` specifically
    lives in each viewset's `perform_update`, since this class has no clean
    way to inspect the request body's field set.

    Set `owner_field` ("author" for Clip, "owner" for Playlist) and
    `content_type` ("clip"/"playlist") on the view, or subclass with them
    set on the class.
    """

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
