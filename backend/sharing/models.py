"""
File Introduction:
Module: sharing.models
Role: Send-with-Request sharing domain — content sharing, review requests, and notifications.

Responsibilities:
- Models plain shares (SharedContent) and review/approval requests (MediaShareRequest)
  against a lightweight content_type/object_id reference (Clip or Playlist).
- Represents share delegation chains via SharedContent.parent_share and soft-delete revocation.
- Models in-app notifications delivered to users.
"""

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from core.models import Department, Organization, Team, TimeStampedModel


class ShareContentType(models.TextChoices):
    """Shared by every model here that points at a Clip or a Playlist."""

    CLIP = "clip", "Clip"
    PLAYLIST = "playlist", "Playlist"


class MediaShareRequest(TimeStampedModel):
    ContentType = ShareContentType

    class RequestType(models.TextChoices):
        FEEDBACK = "feedback", "Review & Feedback"
        APPROVAL = "approval", "Formal Approval"
        UPDATE_REQUIRED = "update_required", "Edit / Update Required"
        TASK = "task", "Action Item Task"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        CHANGES_REQUESTED = "changes_requested", "Changes Requested"
        COMPLETED = "completed", "Completed"
        CANCELED = "canceled", "Canceled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="media_requests")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="initiated_requests")

    content_type = models.CharField(max_length=20, choices=ContentType.choices)
    object_id = models.UUIDField(db_index=True)

    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_requests"
    )
    target_team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_requests")
    target_department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_requests"
    )

    request_type = models.CharField(max_length=30, choices=RequestType.choices, default=RequestType.FEEDBACK)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING)

    message = models.TextField(blank=True, default="")
    due_date = models.DateTimeField(null=True, blank=True)

    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="resolved_requests"
    )
    resolution_note = models.TextField(blank=True, default="")
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "apc_media_share_requests"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["content_type", "object_id"]),
        ]

    def clean(self) -> None:
        if not (self.target_user_id or self.target_team_id or self.target_department_id):
            raise ValidationError("A request must target a user, team, or department.")

    def __str__(self) -> str:
        return f"{self.get_request_type_display()} request on {self.content_type} {self.object_id}"


class SharedContent(TimeStampedModel):
    """A plain share (no request attached) — the "Shared with me" feed's other half."""

    class Permission(models.TextChoices):
        VIEW = "view", "Can View"
        COMMENT = "comment", "Can View & Comment"
        EDIT = "edit", "Can Edit"

    ContentType = ShareContentType

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="shared_content")
    shared_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="content_shared")

    content_type = models.CharField(max_length=20, choices=ShareContentType.choices)
    object_id = models.UUIDField(db_index=True)

    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="content_shared_with_me"
    )
    target_team = models.ForeignKey(
        Team, on_delete=models.SET_NULL, null=True, blank=True, related_name="content_shared_with_team"
    )
    target_department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="content_shared_with_department"
    )

    permission = models.CharField(max_length=20, choices=Permission.choices, default=Permission.VIEW)
    can_view = models.BooleanField(default=True)
    can_edit = models.BooleanField(default=False)
    can_reorder = models.BooleanField(default=False)
    can_reshare = models.BooleanField(default=False)

    parent_share = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="downstream_shares"
    )

    is_active = models.BooleanField(default=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="revoked_shares"
    )

    class Meta:
        db_table = "apc_shared_content"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization"]),
            models.Index(fields=["content_type", "object_id"]),
            models.Index(fields=["content_type", "object_id", "is_active"]),
            models.Index(fields=["shared_by", "is_active"]),
        ]

    def clean(self) -> None:
        if not (self.target_user_id or self.target_team_id or self.target_department_id):
            raise ValidationError("A share must target a user, team, or department.")

    def __str__(self) -> str:
        return f"{self.content_type} {self.object_id} shared by {self.shared_by_id}"


class Notification(models.Model):
    class NotificationType(models.TextChoices):
        CONTENT_SHARED = "content_shared", "Content Shared"
        REQUEST_CREATED = "request_created", "Request Created"
        REQUEST_RESOLVED = "request_resolved", "Request Resolved"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="sent_notifications"
    )
    notification_type = models.CharField(max_length=30, choices=NotificationType.choices)

    title = models.CharField(max_length=255)
    message = models.TextField()
    action_url = models.CharField(max_length=500, blank=True, default="")

    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "apc_notifications"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["recipient", "is_read"])]

    def __str__(self) -> str:
        return f"{self.get_notification_type_display()} -> {self.recipient_id}"
