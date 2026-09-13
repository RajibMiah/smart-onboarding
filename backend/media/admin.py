from django.contrib import admin

from .models import Clip, MediaAsset


@admin.register(Clip)
class ClipAdmin(admin.ModelAdmin):
    list_display = ["title", "organization", "author", "status", "visibility", "created_at"]
    list_filter = ["status", "visibility"]
    search_fields = ["title", "slug"]


admin.site.register(MediaAsset)
