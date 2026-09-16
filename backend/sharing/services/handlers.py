"""
File Introduction:
Module: sharing.services.handlers
Role: Domain services orchestrating share/request lifecycles and their email/notification side effects.

Responsibilities:
- Evaluates who may create, edit, or revoke a share based on ownership and delegation.
- Coordinates request/share creation, resolution, and cascade revocation.
- Dispatches email and in-app notifications via the EmailSenderProtocol/NotifierProtocol adapters.
"""

from __future__ import annotations

from typing import Iterable

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from core.models import User
from core.permissions import user_has_share_capability

from .. import selectors
from ..models import MediaShareRequest, Notification, ShareContentType, SharedContent
from .interfaces import EmailSenderProtocol, NotifierProtocol

ACTION_STATUS_MAP = {
    "approve": MediaShareRequest.Status.APPROVED,
    "request_changes": MediaShareRequest.Status.CHANGES_REQUESTED,
    "complete": MediaShareRequest.Status.COMPLETED,
}


class DjangoEmailSender:
    """`EmailSenderProtocol` backed by Django's configured mail backend."""

    def send(self, *, subject: str, message: str, recipient_list: list[str]) -> None:
        if not recipient_list:
            return
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipient_list,
            fail_silently=True,
        )


class DatabaseNotifier:
    """`NotifierProtocol` backed by the in-app `Notification` model."""

    def notify(
        self,
        *,
        recipients: Iterable[User],
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
                if recipient.id != sender.id
            ]
        )


def content_url(content_type: str, object_id) -> str:
    if content_type == ShareContentType.CLIP:
        return f"/studio?clip={object_id}"
    return f"/library/playlists/{object_id}"


def capability_defaults_for_permission(permission: str) -> dict:
    """Derives the granular capability flags a `permission` tier implies."""
    if permission == SharedContent.Permission.EDIT:
        return {"can_view": True, "can_edit": True, "can_reorder": True, "can_reshare": True}
    return {"can_view": True, "can_edit": False, "can_reorder": False, "can_reshare": False}


def can_manage_share(user: User, share: SharedContent) -> bool:
    """Whether `user` may edit this share's capability flags or revoke it."""
    if share.shared_by_id == user.id:
        return True
    membership = getattr(user, "membership", None)
    if membership and membership.is_global_admin:
        return True
    target = selectors.resolve_shared_content(share.content_type, share.object_id, share.organization_id)
    if target is None:
        return False
    owner_field = "author" if share.content_type == ShareContentType.CLIP else "owner"
    if getattr(target, f"{owner_field}_id", None) == user.id:
        return True
    return user_has_share_capability(user, target, owner_field=owner_field, content_type=share.content_type, capability="can_reshare")


def validate_share_target(*, content_type, object_id, target_user, target_team, target_department, organization, user) -> None:
    """Enforces who may create a share/request: the content's own owner, a
    global admin, or someone holding an active `can_reshare` grant on it."""
    if content_type is not None and object_id is not None:
        model_target = selectors.resolve_shared_content(content_type, object_id, organization.id)
        if model_target is None:
            raise serializers.ValidationError("That clip or playlist doesn't exist in your workspace.")

        owner_field = "author" if content_type == ShareContentType.CLIP else "owner"
        if not user_has_share_capability(
            user, model_target, owner_field=owner_field, content_type=content_type, capability="can_reshare"
        ):
            raise PermissionDenied("You don't have permission to share this content further.")

    for value in (target_user, target_team, target_department):
        if value is not None and value.organization_id != organization.id:
            raise serializers.ValidationError("Targets must belong to your workspace.")


class ShareRequestService:
    """Domain service for `MediaShareRequest` creation and resolution."""

    def __init__(self, email_sender: EmailSenderProtocol, notifier: NotifierProtocol) -> None:
        self._email_sender = email_sender
        self._notifier = notifier

    def create(self, serializer, user: User) -> MediaShareRequest:
        data = serializer.validated_data
        validate_share_target(
            content_type=data.get("content_type"),
            object_id=data.get("object_id"),
            target_user=data.get("target_user"),
            target_team=data.get("target_team"),
            target_department=data.get("target_department"),
            organization=user.organization,
            user=user,
        )

        instance = serializer.save(organization=user.organization, created_by=user)
        recipients = selectors.recipient_users(
            instance.target_user_id, instance.target_team_id, instance.target_department_id
        )

        emails = list(recipients.values_list("email", flat=True))
        review_url = f"{settings.FRONTEND_URL}{content_url(instance.content_type, instance.object_id)}"
        self._email_sender.send(
            subject=f"{instance.created_by.full_name} sent you a {instance.get_request_type_display()} request on APC",
            message=(
                f"{instance.created_by.full_name} is asking for your {instance.get_request_type_display().lower()} "
                f"on a {instance.content_type} in APC.\n\n"
                f"{instance.message}\n\n"
                f"Open it here: {review_url}\n"
                + (f"\nDue: {instance.due_date:%B %d, %Y}" if instance.due_date else "")
            ),
            recipient_list=emails,
        )
        self._notifier.notify(
            recipients=recipients,
            sender=user,
            notification_type=Notification.NotificationType.REQUEST_CREATED,
            title=f"{instance.created_by.full_name} sent a {instance.get_request_type_display()} request",
            message=instance.message,
            action_url=content_url(instance.content_type, instance.object_id),
        )
        return instance

    def resolve(self, instance: MediaShareRequest, *, action: str, note: str, resolved_by: User) -> MediaShareRequest:
        instance.status = ACTION_STATUS_MAP[action]
        instance.resolution_note = note
        instance.resolved_by = resolved_by
        instance.resolved_at = timezone.now()
        instance.save(update_fields=["status", "resolution_note", "resolved_by", "resolved_at", "updated_at"])

        self._notifier.notify(
            recipients=User.objects.filter(id=instance.created_by_id),
            sender=resolved_by,
            notification_type=Notification.NotificationType.REQUEST_RESOLVED,
            title=f"{resolved_by.full_name} {instance.get_status_display().lower()} your request",
            message=instance.resolution_note,
            action_url=content_url(instance.content_type, instance.object_id),
        )
        return instance


class SharedContentService:
    """Domain service for plain (request-less) shares: creation, capability
    edits, and cascade revocation."""

    def __init__(self, notifier: NotifierProtocol) -> None:
        self._notifier = notifier

    def create(self, serializer, user: User) -> SharedContent:
        data = serializer.validated_data
        validate_share_target(
            content_type=data.get("content_type"),
            object_id=data.get("object_id"),
            target_user=data.get("target_user"),
            target_team=data.get("target_team"),
            target_department=data.get("target_department"),
            organization=user.organization,
            user=user,
        )

        content_type = data["content_type"]
        object_id = data["object_id"]
        capability_defaults = capability_defaults_for_permission(data.get("permission", SharedContent.Permission.VIEW))
        parent_share = selectors.resolve_parent_share(user, content_type, object_id)

        instance = serializer.save(
            organization=user.organization, shared_by=user, parent_share=parent_share, **capability_defaults
        )
        recipients = selectors.recipient_users(
            instance.target_user_id, instance.target_team_id, instance.target_department_id
        )
        self._notifier.notify(
            recipients=recipients,
            sender=user,
            notification_type=Notification.NotificationType.CONTENT_SHARED,
            title=f"{instance.shared_by.full_name} shared a {instance.content_type} with you",
            message="",
            action_url=content_url(instance.content_type, instance.object_id),
        )
        return instance

    def update(self, serializer, user: User) -> SharedContent:
        instance = serializer.instance
        data = serializer.validated_data
        validate_share_target(
            content_type=data.get("content_type"),
            object_id=data.get("object_id"),
            target_user=data.get("target_user"),
            target_team=data.get("target_team"),
            target_department=data.get("target_department"),
            organization=user.organization,
            user=user,
        )
        if not can_manage_share(user, instance):
            raise PermissionDenied("You don't have permission to modify this share.")
        return serializer.save()

    def revoke(self, instance: SharedContent, user: User) -> SharedContent:
        if not can_manage_share(user, instance):
            raise PermissionDenied("You don't have permission to revoke this share.")
        self._cascade_revoke(instance.id, user)
        instance.refresh_from_db()
        return instance

    @staticmethod
    def _cascade_revoke(root_share_id, revoked_by: User) -> None:
        """Deactivates a share and every share delegated beneath it, at any depth."""
        now = timezone.now()
        frontier = [root_share_id]
        while frontier:
            SharedContent.objects.filter(pk__in=frontier, is_active=True).update(
                is_active=False, revoked_at=now, revoked_by=revoked_by
            )
            frontier = list(SharedContent.objects.filter(parent_share_id__in=frontier).values_list("id", flat=True))


def mark_notification_read(notification: Notification) -> Notification:
    if not notification.is_read:
        notification.is_read = True
        notification.save(update_fields=["is_read"])
    return notification


def mark_all_notifications_read(user_id) -> int:
    return selectors.notifications_for_user(user_id).filter(is_read=False).update(is_read=True)


def _target_label(obj) -> str:
    if obj.target_department_id:
        return f"Department: {obj.target_department.name}"
    if obj.target_team_id:
        return f"Team: {obj.target_team.name}"
    if obj.target_user_id:
        return f"User: {obj.target_user.full_name}"
    return "Unassigned"


def _share_feed_item(share: SharedContent, request) -> dict:
    content = selectors.resolve_shared_content(share.content_type, share.object_id, share.organization_id)
    return {
        "id": str(share.id),
        "kind": "share",
        "content_type": share.content_type,
        "object_id": str(share.object_id),
        "content_title": content.title if content else "",
        "content_thumbnail_url": selectors.content_thumbnail_url(content, request),
        "actor_name": share.shared_by.full_name,
        "actor_avatar_url": share.shared_by.avatar_url,
        "target_label": _target_label(share),
        "permission": share.permission,
        "request_type": None,
        "status": None,
        "created_at": share.created_at.isoformat(),
    }


def _request_feed_item(req: MediaShareRequest, request) -> dict:
    content = selectors.resolve_shared_content(req.content_type, req.object_id, req.organization_id)
    return {
        "id": str(req.id),
        "kind": "request",
        "content_type": req.content_type,
        "object_id": str(req.object_id),
        "content_title": content.title if content else "",
        "content_thumbnail_url": selectors.content_thumbnail_url(content, request),
        "actor_name": req.created_by.full_name,
        "actor_avatar_url": req.created_by.avatar_url,
        "target_label": _target_label(req),
        "permission": None,
        "request_type": req.request_type,
        "status": req.status,
        "created_at": req.created_at.isoformat(),
    }


def build_shared_feed(user: User, scope: str, request) -> list[dict]:
    """Merges `SharedContent` and `MediaShareRequest` into one feed shape."""
    shares = selectors.feed_shares(user, scope)
    requests_qs = selectors.feed_requests(user, scope)

    items = [_share_feed_item(share, request) for share in shares] + [
        _request_feed_item(req, request) for req in requests_qs
    ]
    items.sort(key=lambda item: item["created_at"], reverse=True)
    return items
