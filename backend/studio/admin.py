from django.contrib import admin

from .models import BlurRegion, TextOverlay, TimelineTrack, ZoomRegion

admin.site.register(TimelineTrack)
admin.site.register(ZoomRegion)
admin.site.register(BlurRegion)
admin.site.register(TextOverlay)
