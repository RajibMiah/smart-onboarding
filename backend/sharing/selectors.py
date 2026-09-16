"""
File Introduction:
Module: sharing.selectors
Role: Read-only query layer for shares, requests, notifications, and the shared feed.

Responsibilities:
- Resolves shared content targets and recipient sets for a given content/team/department.
- Provides workspace-scoped, filterable querysets for requests, shares, and the dashboard/feed views.
"""

from __future__ import annotations

from django.db.models import Q, QuerySet

from collaboration.models import Playlist
from core.models import Team, TeamMembership, User
from media.models import Clip

from .models import MediaShareRequest, Notification, ShareContentType, SharedContent


def resolve_shared_content(content_type: str, object_id, organization_id) -> Clip | Playlist | None:
    model = Clip if content_type == ShareContentType.CLIP else Playlist
    return model.objects.filter(pk=object_id, organization_id=organization_id).first()


def content_thumbnail_url(target: Clip | Playlist | None, request) -> str:
    if not isinstance(target, Clip):
        return ""
    if target.thumbnail:
        return request.build_absolute_uri(target.thumbnail.url) if request else target.thumbnail.url
    return target.thumbnail_url


def recipient_users(target_user_id, target_team_id, target_department_id) -> QuerySet[User]:
    """Every user a share/request should notify: the target user, or
    everyone in the target team/department."""
    if target_user_id:
        return User.objects.filter(id=target_user_id)
    if target_team_id:
        return User.objects.filter(team_memberships__team_id=target_team_id)
    if target_department_id:
        return User.objects.filter(team_memberships__team__department_id=target_department_id)
    return User.objects.none()


def user_team_and_department(user: User) -> tuple[str | None, str | None]:
    membership = user.team_memberships.select_related("team").first()
    team_id = membership.team_id if membership else None
    department_id = membership.team.department_id if membership and membership.team.department_id else None
    return team_id, department_id


def user_all_team_and_department_ids(user: User) -> tuple[list, list]:
    """Every team/department `user` belongs to (not just the first, unlike `user_team_and_department`)."""
    team_ids = list(TeamMembership.objects.filter(user_id=user.id).values_list("team_id", flat=True))
    department_ids = list(
        Team.objects.filter(id__in=team_ids).exclude(department_id=None).values_list("department_id", flat=True)
    )
    return team_ids, department_ids


def resolve_parent_share(user: User, content_type: str, object_id) -> SharedContent | None:
    """Resolves the delegation-chain parent for a new share: `user`'s own
    active inbound share on this content, or None if they're its root owner."""
    target = resolve_shared_content(content_type, object_id, user.organization_id)
    owner_field = "author" if content_type == ShareContentType.CLIP else "owner"
    if target is not None and getattr(target, f"{owner_field}_id", None) == user.id:
        return None

    team_ids, department_ids = user_all_team_and_department_ids(user)
    return (
        SharedContent.objects.filter(content_type=content_type, object_id=object_id, is_active=True)
        .filter(Q(target_user_id=user.id) | Q(target_team_id__in=team_ids) | Q(target_department_id__in=department_ids))
        .order_by("-created_at")
        .first()
    )


def media_share_requests_for_user(user: User, scope: str | None) -> QuerySet[MediaShareRequest]:
    queryset = MediaShareRequest.objects.filter(organization_id=user.organization_id).select_related(
        "created_by", "target_user", "target_team", "target_department"
    )

    user_team_id, user_department_id = user_team_and_department(user)

    # Each clause is only added when the user actually has that membership —
    # `Q(target_team_id=None)` would otherwise match "no team target" rather
    # than "targets my team".
    assigned_to_user = Q(target_user_id=user.id)
    if user_team_id is not None:
        assigned_to_user |= Q(target_team_id=user_team_id)
    if user_department_id is not None:
        assigned_to_user |= Q(target_department_id=user_department_id)

    if scope == "assigned_to_me":
        queryset = queryset.filter(assigned_to_user)
    elif scope == "created_by_me":
        queryset = queryset.filter(created_by_id=user.id)
    elif scope == "archived":
        queryset = queryset.filter(Q(created_by_id=user.id) | assigned_to_user).filter(
            status__in=[MediaShareRequest.Status.COMPLETED, MediaShareRequest.Status.CANCELED]
        )

    return queryset


def shared_content_for_user(user: User, filter_param: str | None) -> QuerySet[SharedContent]:
    queryset = SharedContent.objects.filter(organization_id=user.organization_id).select_related(
        "shared_by", "target_user", "target_team", "target_department", "revoked_by"
    )
    if filter_param == "shared_by_me":
        queryset = queryset.filter(shared_by_id=user.id)
    return queryset


def shared_content_dashboard(user: User, filters: dict) -> QuerySet[SharedContent]:
    """Scoped for the Share Management dashboard: a global admin sees every
    share in the org; everyone else sees shares on content they own plus
    shares they personally issued."""
    membership = getattr(user, "membership", None)
    queryset = SharedContent.objects.filter(organization_id=user.organization_id).select_related(
        "shared_by", "target_user", "target_team", "target_department", "revoked_by", "parent_share"
    )

    if not (membership and membership.is_global_admin):
        owned_clip_ids = Clip.objects.filter(author=user).values_list("id", flat=True)
        owned_playlist_ids = Playlist.objects.filter(owner=user).values_list("id", flat=True)
        queryset = queryset.filter(
            Q(shared_by_id=user.id)
            | Q(content_type=ShareContentType.CLIP, object_id__in=owned_clip_ids)
            | Q(content_type=ShareContentType.PLAYLIST, object_id__in=owned_playlist_ids)
        )

    status_param = filters.get("status")
    if status_param == "active":
        queryset = queryset.filter(is_active=True)
    elif status_param == "revoked":
        queryset = queryset.filter(is_active=False)

    resource_type = filters.get("resource_type")
    if resource_type in (ShareContentType.CLIP, ShareContentType.PLAYLIST):
        queryset = queryset.filter(content_type=resource_type)

    target_type = filters.get("target_type")
    if target_type == "user":
        queryset = queryset.filter(target_user__isnull=False)
    elif target_type == "team":
        queryset = queryset.filter(target_team__isnull=False)
    elif target_type == "department":
        queryset = queryset.filter(target_department__isnull=False)

    scope = filters.get("scope")
    if scope == "shared_by_me":
        queryset = queryset.filter(shared_by_id=user.id)
    elif scope == "shared_with_me":
        team_ids, department_ids = user_all_team_and_department_ids(user)
        queryset = queryset.filter(
            Q(target_user_id=user.id) | Q(target_team_id__in=team_ids) | Q(target_department_id__in=department_ids)
        )

    search = (filters.get("search") or "").strip()
    if search:
        queryset = queryset.filter(
            Q(target_user__first_name__icontains=search)
            | Q(target_user__last_name__icontains=search)
            | Q(target_user__email__icontains=search)
            | Q(target_team__name__icontains=search)
            | Q(target_department__name__icontains=search)
        )

    return queryset.distinct().order_by("-created_at")


def feed_shares(user: User, scope: str) -> QuerySet[SharedContent]:
    queryset = SharedContent.objects.filter(organization_id=user.organization_id).select_related(
        "shared_by", "target_user", "target_team", "target_department"
    )
    if scope == "by_me":
        return queryset.filter(shared_by_id=user.id)
    return queryset.filter(_targets_user_q(user))


def feed_requests(user: User, scope: str) -> QuerySet[MediaShareRequest]:
    queryset = MediaShareRequest.objects.filter(organization_id=user.organization_id).select_related(
        "created_by", "target_user", "target_team", "target_department"
    )
    if scope == "by_me":
        return queryset.filter(created_by_id=user.id)
    return queryset.filter(_targets_user_q(user))


def _targets_user_q(user: User, prefix: str = "") -> Q:
    user_team_id, user_department_id = user_team_and_department(user)
    q = Q(**{f"{prefix}target_user_id": user.id})
    if user_team_id is not None:
        q |= Q(**{f"{prefix}target_team_id": user_team_id})
    if user_department_id is not None:
        q |= Q(**{f"{prefix}target_department_id": user_department_id})
    return q


def notifications_for_user(user_id) -> QuerySet[Notification]:
    return Notification.objects.filter(recipient_id=user_id).select_related("sender")
