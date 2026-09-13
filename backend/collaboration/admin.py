from django.contrib import admin

from .models import DocumentationPage, PageClipItem, Playlist, PlaylistItem, StepGuide

admin.site.register(Playlist)
admin.site.register(PlaylistItem)
admin.site.register(DocumentationPage)
admin.site.register(PageClipItem)
admin.site.register(StepGuide)
