from django.conf import settings
from django.core.mail import send_mail
from django.db.models import Q, QuerySet
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from collaboration.models import Playlist
from core.models import Team, TeamMembership, User
from core.permissions import IsWorkspaceMember
from media.models import Clip

from .models import MediaShareRequest, Notification, SharedContent
from .serializers import (
    MediaShareRequestSerializer,
    NotificationSerializer,
    RequestActionSerializer,
    SharedContentSerializer,
    can_manage_share,
    content_thumbnail_url,
    resolve_shared_content,
)


def _recipient_users(target_user_id, target_team_id, target_department_id) -> QuerySet[User]:
    """Every user a share/request should notify — one for a user target, everyone in the team/department for those.

    `User` has no direct `team`/`department` FK — both are only reachable
    through `TeamMembership` (see `core.serializers.OrgMemberSerializer`,
    which derives them the same way).
    """
    if target_user_id:
        return User.objects.filter(id=target_user_id)
    if target_team_id:
        return User.objects.filter(team_memberships__team_id=target_team_id)
    if target_department_id:
        return User.objects.filter(team_memberships__team__department_id=target_department_id)
    return User.objects.none()


def _user_team_and_department(user: User) -> tuple[str | None, str | None]:
    membership = user.team_memberships.select_related("team").first()
    team_id = membership.team_id if membership else None
    department_id = membership.team.department_id if membership and membership.team.department_id else None
    return team_id, department_id


def _user_all_team_and_department_ids(user: User) -> tuple[list, list]:
    """Every team/department `user` belongs to (not just the first, unlike
    `_user_team_and_department` above) — needed here so resolving a
    delegation-chain parent or scoping the dashboard doesn't miss a share
    routed through a second team membership."""
    team_ids = list(TeamMembership.objects.filter(user_id=user.id).values_list("team_id", flat=True))
    department_ids = list(
        Team.objects.filter(id__in=team_ids).exclude(department_id=None).values_list("department_id", flat=True)
    )
    return team_ids, department_ids


def _capability_defaults_for_permission(permission: str) -> dict:
    """New shares made through the simple Share modal only ever send
    `permission` (view/comment/edit), not the granular booleans the Share
    Management dashboard edits directly — this derives sensible defaults so
    both paths agree on what an "edit" share actually grants."""
    if permission == SharedContent.Permission.EDIT:
        return {"can_view": True, "can_edit": True, "can_reorder": True, "can_reshare": True}
    return {"can_view": True, "can_edit": False, "can_reorder": False, "can_reshare": False}


def _resolve_parent_share(user: User, content_type: str, object_id) -> SharedContent | None:
    """If `user` isn't the content's root owner, their own active inbound
    share on this same content becomes this new share's `parent_share` —
    that's what builds the delegation chain the dashboard displays and what
    a cascade revoke walks back down."""
    target = resolve_shared_content(content_type, object_id, user.organization_id)
    owner_field = "author" if content_type == MediaShareRequest.ContentType.CLIP else "owner"
    if target is not None and getattr(target, f"{owner_field}_id", None) == user.id:
        return None

    team_ids, department_ids = _user_all_team_and_department_ids(user)
    return (
        SharedContent.objects.filter(content_type=content_type, object_id=object_id, is_active=True)
        .filter(Q(target_user_id=user.id) | Q(target_team_id__in=team_ids) | Q(target_department_id__in=department_ids))
        .order_by("-created_at")
        .first()
    )


def _cascade_revoke(root_share_id, revoked_by: User) -> None:
    """Iterative (not recursive-function) breadth-first walk down
    `downstream_shares` — deactivates the share itself and every share ever
    delegated beneath it, however many levels deep."""
    now = timezone.now()
    frontier = [root_share_id]
    while frontier:
        SharedContent.objects.filter(pk__in=frontier, is_active=True).update(
            is_active=False, revoked_at=now, revoked_by=revoked_by
        )
        frontier = list(SharedContent.objects.filter(parent_share_id__in=frontier).values_list("id", flat=True))


def _content_url(content_type: str, object_id) -> str:
    # The Review page has no deep-link support of its own — it only reads
    # from an already-hydrated Studio session — so a clip link goes through
    # the `?clip=` resume entry point instead of a dead-end `/studio/review`.
    if content_type == MediaShareRequest.ContentType.CLIP:
        return f"/studio?clip={object_id}"
    return f"/library/playlists/{object_id}"


def _notify_recipients(
    recipients: QuerySet[User],
    sender: User,
    notification_type: str,
    title: str,
    message: str,
    action_url: str,
) -> None:
    Notification.objects.bulk_create(
        [
            Notification(
                recipient=recipient,
                sender=sender,
                notification_type=notification_type,
                title=title,
                message=message,
                action_url=action_url,
            )
            for recipient in recipients
            if recipient.id != sender.id  # don't notify yourself when self-targeting for a smoke test
        ]
    )


def _send_request_email(instance: MediaShareRequest, recipients: QuerySet[User]) -> None:
    emails = list(recipients.values_list("email", flat=True))
    if not emails:
        return
    review_url = f"{settings.FRONTEND_URL}{_content_url(instance.content_type, instance.object_id)}"
    send_mail(
        subject=f"{instance.created_by.full_name} sent you a {instance.get_request_type_display()} request on APC",
        message=(
            f"{instance.created_by.full_name} is asking for your {instance.get_request_type_display().lower()} "
            f"on a {instance.content_type} in APC.\n\n"
            f"{instance.message}\n\n"
            f"Open it here: {review_url}\n"
            + (f"\nDue: {instance.due_date:%B %d, %Y}" if instance.due_date else "")
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=emails,
        fail_silently=True,
    )


class MediaShareRequestViewSet(viewsets.ModelViewSet):
    serializer_class = MediaShareRequestSerializer
    permission_classes = [IsWorkspaceMember]
    filterset_fields = ["status", "priority", "content_type"]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        queryset = MediaShareRequest.objects.filter(organization_id=user.organization_id).select_related(
            "created_by", "target_user", "target_team", "target_department"
        )

        user_team_id, user_department_id = _user_team_and_department(user)

        # `Q(target_team_id=None)` would match "no team target" (true for
        # user- or department-targeted rows too), not "targets my team" — so
        # each clause is only added when the user actually has that
        # membership, instead of always including it with a `None` value.
        assigned_to_user = Q(target_user_id=user.id)
        if user_team_id is not None:
            assigned_to_user |= Q(target_team_id=user_team_id)
        if user_department_id is not None:
            assigned_to_user |= Q(target_department_id=user_department_id)

        scope = self.request.query_params.get("filter")
        if scope == "assigned_to_me":
            queryset = queryset.filter(assigned_to_user)
        elif scope == "created_by_me":
            queryset = queryset.filter(created_by_id=user.id)
        elif scope == "archived":
            # Either side of a request the user was involved in, once it's
            # done — not scoped to just "assigned" or just "created".
            queryset = queryset.filter(Q(created_by_id=user.id) | assigned_to_user).filter(
                status__in=[MediaShareRequest.Status.COMPLETED, MediaShareRequest.Status.CANCELED]
            )

        return queryset

    def perform_create(self, serializer):
        instance = serializer.save(organization=self.request.user.organization, created_by=self.request.user)
        recipients = _recipient_users(instance.target_user_id, instance.target_team_id, instance.target_department_id)
        _send_request_email(instance, recipients)
        _notify_recipients(
            recipients,
            sender=self.request.user,
            notification_type=Notification.NotificationType.REQUEST_CREATED,
            title=f"{instance.created_by.full_name} sent a {instance.get_request_type_display()} request",
            message=instance.message,
            action_url=_content_url(instance.content_type, instance.object_id),
        )

    # Named `resolve_action`, not `action` — DRF's `ViewSet` uses `self.action`
    # internally (set by the router to the current action's name, e.g. "list"
    # or "create") for permission checks and exception handling. A method
    # named `action` overwrites that attribute with itself, so anything
    # downstream expecting `self.action` to be a string blows up with an
    # `AttributeError`. `url_path="action"` keeps the actual URL/API contract
    # (`POST /requests/<id>/action/`) unchanged.
    @action(detail=True, methods=["post"], url_path="action")
    def resolve_action(self, request, pk=None):
        """Resolves a request: {"action": "approve"|"request_changes"|"complete", "note": "..."}."""
        instance = self.get_object()
        serializer = RequestActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        instance.status = RequestActionSerializer.ACTION_STATUS_MAP[serializer.validated_data["action"]]
        instance.resolution_note = serializer.validated_data["note"]
        instance.resolved_by = request.user
        instance.resolved_at = timezone.now()
        instance.save(update_fields=["status", "resolution_note", "resolved_by", "resolved_at", "updated_at"])

        _notify_recipients(
            User.objects.filter(id=instance.created_by_id),
            sender=request.user,
            notification_type=Notification.NotificationType.REQUEST_RESOLVED,
            title=f"{request.user.full_name} {instance.get_status_display().lower()} your request",
            message=instance.resolution_note,
            action_url=_content_url(instance.content_type, instance.object_id),
        )

        return Response(MediaShareRequestSerializer(instance, context={"request": request}).data, status=status.HTTP_200_OK)


class SharedContentViewSet(viewsets.ModelViewSet):
    """Plain shares (no request attached) — the other half of the "Shared with me" feed.

    Also backs the Share Management dashboard: `patch` edits an existing
    share's capability flags, `revoke` soft-deletes it (and cascades to
    everything delegated beneath it), and `dashboard` returns the scoped
    list a root owner or an intermediate delegate is allowed to manage.
    """

    serializer_class = SharedContentSerializer
    permission_classes = [IsWorkspaceMember]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        queryset = SharedContent.objects.filter(organization_id=user.organization_id).select_related(
            "shared_by", "target_user", "target_team", "target_department", "revoked_by"
        )
        if self.request.query_params.get("filter") == "shared_by_me":
            queryset = queryset.filter(shared_by_id=user.id)
        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        content_type = serializer.validated_data["content_type"]
        object_id = serializer.validated_data["object_id"]
        capability_defaults = _capability_defaults_for_permission(
            serializer.validated_data.get("permission", SharedContent.Permission.VIEW)
        )
        parent_share = _resolve_parent_share(user, content_type, object_id)

        instance = serializer.save(
            organization=user.organization, shared_by=user, parent_share=parent_share, **capability_defaults
        )
        recipients = _recipient_users(instance.target_user_id, instance.target_team_id, instance.target_department_id)
        _notify_recipients(
            recipients,
            sender=user,
            notification_type=Notification.NotificationType.CONTENT_SHARED,
            title=f"{instance.shared_by.full_name} shared a {instance.content_type} with you",
            message="",
            action_url=_content_url(instance.content_type, instance.object_id),
        )

    def perform_update(self, serializer):
        instance = serializer.instance
        if not can_manage_share(self.request.user, instance):
            raise PermissionDenied("You don't have permission to modify this share.")
        serializer.save()

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        instance = self.get_object()
        if not can_manage_share(request.user, instance):
            raise PermissionDenied("You don't have permission to revoke this share.")
        _cascade_revoke(instance.id, request.user)
        instance.refresh_from_db()
        return Response(SharedContentSerializer(instance, context={"request": request}).data)

    @action(detail=False, methods=["get"])
    def dashboard(self, request):
        """Scoped for the Share Management dashboard: a global admin sees
        every share in the org; everyone else sees shares on content they
        own (every delegation level, since it's their content) plus shares
        they personally issued on content they don't own (their own
        delegated invitations) — never another delegate's issued shares on
        content neither of them owns.
        """
        user = request.user
        membership = getattr(user, "membership", None)
        queryset = SharedContent.objects.filter(organization_id=user.organization_id).select_related(
            "shared_by", "target_user", "target_team", "target_department", "revoked_by", "parent_share"
        )

        if not (membership and membership.is_global_admin):
            owned_clip_ids = Clip.objects.filter(author=user).values_list("id", flat=True)
            owned_playlist_ids = Playlist.objects.filter(owner=user).values_list("id", flat=True)
            queryset = queryset.filter(
                Q(shared_by_id=user.id)
                | Q(content_type=SharedContent.ContentType.CLIP, object_id__in=owned_clip_ids)
                | Q(content_type=SharedContent.ContentType.PLAYLIST, object_id__in=owned_playlist_ids)
            )

        status_param = request.query_params.get("status")
        if status_param == "active":
            queryset = queryset.filter(is_active=True)
        elif status_param == "revoked":
            queryset = queryset.filter(is_active=False)

        resource_type = request.query_params.get("resource_type")
        if resource_type in (SharedContent.ContentType.CLIP, SharedContent.ContentType.PLAYLIST):
            queryset = queryset.filter(content_type=resource_type)

        target_type = request.query_params.get("target_type")
        if target_type == "user":
            queryset = queryset.filter(target_user__isnull=False)
        elif target_type == "team":
            queryset = queryset.filter(target_team__isnull=False)
        elif target_type == "department":
            queryset = queryset.filter(target_department__isnull=False)

        scope = request.query_params.get("scope")
        if scope == "shared_by_me":
            queryset = queryset.filter(shared_by_id=user.id)
        elif scope == "shared_with_me":
            team_ids, department_ids = _user_all_team_and_department_ids(user)
            queryset = queryset.filter(
                Q(target_user_id=user.id) | Q(target_team_id__in=team_ids) | Q(target_department_id__in=department_ids)
            )

        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(target_user__first_name__icontains=search)
                | Q(target_user__last_name__icontains=search)
                | Q(target_user__email__icontains=search)
                | Q(target_team__name__icontains=search)
                | Q(target_department__name__icontains=search)
            )

        queryset = queryset.distinct().order_by("-created_at")
        serializer = SharedContentSerializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)


class SharedFeedView(APIView):
    """GET /api/v1/sharing/feed/?scope=with_me|by_me — merges SharedContent + MediaShareRequest into one feed.

    A plain APIView rather than a ViewSet: the two source tables have
    different shapes, so this normalizes both into one common item shape
    instead of forcing a single ModelSerializer over the union.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        scope = request.query_params.get("scope", "with_me")
        user_team_id, user_department_id = _user_team_and_department(user)

        def targets_me(prefix: str = "") -> Q:
            q = Q(**{f"{prefix}target_user_id": user.id})
            if user_team_id is not None:
                q |= Q(**{f"{prefix}target_team_id": user_team_id})
            if user_department_id is not None:
                q |= Q(**{f"{prefix}target_department_id": user_department_id})
            return q

        shares = SharedContent.objects.filter(organization_id=user.organization_id).select_related(
            "shared_by", "target_user", "target_team", "target_department"
        )
        requests_qs = MediaShareRequest.objects.filter(organization_id=user.organization_id).select_related(
            "created_by", "target_user", "target_team", "target_department"
        )

        if scope == "by_me":
            shares = shares.filter(shared_by_id=user.id)
            requests_qs = requests_qs.filter(created_by_id=user.id)
        else:
            shares = shares.filter(targets_me())
            requests_qs = requests_qs.filter(targets_me())

        items = [self._share_item(share, request) for share in shares] + [
            self._request_item(req, request) for req in requests_qs
        ]
        items.sort(key=lambda item: item["created_at"], reverse=True)
        return Response({"count": len(items), "results": items})

    @staticmethod
    def _target_label(obj) -> str:
        if obj.target_department_id:
            return f"Department: {obj.target_department.name}"
        if obj.target_team_id:
            return f"Team: {obj.target_team.name}"
        if obj.target_user_id:
            return f"User: {obj.target_user.full_name}"
        return "Unassigned"

    def _share_item(self, share: SharedContent, request) -> dict:
        content = resolve_shared_content(share.content_type, share.object_id, share.organization_id)
        return {
            "id": str(share.id),
            "kind": "share",
            "content_type": share.content_type,
            "object_id": str(share.object_id),
            "content_title": content.title if content else "",
            "content_thumbnail_url": content_thumbnail_url(content, request),
            "actor_name": share.shared_by.full_name,
            "actor_avatar_url": share.shared_by.avatar_url,
            "target_label": self._target_label(share),
            "permission": share.permission,
            "request_type": None,
            "status": None,
            "created_at": share.created_at.isoformat(),
        }

    def _request_item(self, req: MediaShareRequest, request) -> dict:
        content = resolve_shared_content(req.content_type, req.object_id, req.organization_id)
        return {
            "id": str(req.id),
            "kind": "request",
            "content_type": req.content_type,
            "object_id": str(req.object_id),
            "content_title": content.title if content else "",
            "content_thumbnail_url": content_thumbnail_url(content, request),
            "actor_name": req.created_by.full_name,
            "actor_avatar_url": req.created_by.avatar_url,
            "target_label": self._target_label(req),
            "permission": None,
            "request_type": req.request_type,
            "status": req.status,
            "created_at": req.created_at.isoformat(),
        }


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["is_read", "notification_type"]

    def get_queryset(self):
        return Notification.objects.filter(recipient_id=self.request.user.id).select_related("sender")

    @action(detail=True, methods=["patch"], url_path="read")
    def mark_read(self, request, pk=None):
        instance = self.get_object()
        if not instance.is_read:
            instance.is_read = True
            instance.save(update_fields=["is_read"])
        return Response(NotificationSerializer(instance).data)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({"updated": updated})
