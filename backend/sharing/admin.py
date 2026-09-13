from django.contrib import admin

from .models import MediaShareRequest, Notification, SharedContent


@admin.register(MediaShareRequest)
class MediaShareRequestAdmin(admin.ModelAdmin):
    list_display = ["content_type", "object_id", "request_type", "priority", "status", "created_by", "created_at"]
    list_filter = ["status", "priority", "request_type", "content_type"]


@admin.register(SharedContent)
class SharedContentAdmin(admin.ModelAdmin):
    list_display = ["content_type", "object_id", "shared_by", "permission", "created_at"]
    list_filter = ["permission", "content_type"]


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["notification_type", "recipient", "is_read", "created_at"]
    list_filter = ["notification_type", "is_read"]
