from django.conf import settings
from django.core.mail import send_mail
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.models import User
from core.permissions import IsWorkspaceMember

from .models import MediaShareRequest
from .serializers import MediaShareRequestSerializer, RequestActionSerializer


def _recipient_emails(instance: MediaShareRequest) -> list[str]:
    """Every user this request should notify — one for a user target, everyone in the team/department for those.

    `User` has no direct `team`/`department` FK — both are only reachable
    through `TeamMembership` (see `core.serializers.OrgMemberSerializer`,
    which derives them the same way).
    """
    if instance.target_user_id:
        return [instance.target_user.email]
    if instance.target_team_id:
        return list(
            User.objects.filter(team_memberships__team_id=instance.target_team_id).values_list("email", flat=True)
        )
    if instance.target_department_id:
        return list(
            User.objects.filter(team_memberships__team__department_id=instance.target_department_id).values_list(
                "email", flat=True
            )
        )
    return []


def _send_request_email(instance: MediaShareRequest) -> None:
    recipients = _recipient_emails(instance)
    if not recipients:
        return
    # The Review page has no deep-link support of its own — it only reads
    # from an already-hydrated Studio session — so a clip link goes through
    # the `?clip=` resume entry point instead of a dead-end `/studio/review`.
    review_url = (
        f"{settings.FRONTEND_URL}/studio?clip={instance.object_id}"
        if instance.content_type == MediaShareRequest.ContentType.CLIP
        else f"{settings.FRONTEND_URL}/library/playlists/{instance.object_id}"
    )
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
        recipient_list=recipients,
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

        # `User` has no direct `team`/`department` FK — resolved through
        # `TeamMembership`, same as `core.serializers.OrgMemberSerializer`.
        membership = user.team_memberships.select_related("team").first()
        user_team_id = membership.team_id if membership else None
        user_department_id = membership.team.department_id if membership and membership.team.department_id else None

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
        _send_request_email(instance)

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

        return Response(MediaShareRequestSerializer(instance, context={"request": request}).data, status=status.HTTP_200_OK)
