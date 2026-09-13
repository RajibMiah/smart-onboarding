from django.contrib import admin

from .models import MediaShareRequest


@admin.register(MediaShareRequest)
class MediaShareRequestAdmin(admin.ModelAdmin):
    list_display = ["content_type", "object_id", "request_type", "priority", "status", "created_by", "created_at"]
    list_filter = ["status", "priority", "request_type", "content_type"]
