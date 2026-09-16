"""
File Introduction:
Module: collaboration.views
Role: HTTP entry points for playlists, documentation pages, and step guides.

Responsibilities:
- Routes requests to selectors for reads and to domain services for sequencing writes.
"""

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response

from core.permissions import IsOwnerOrDelegatedEditor, IsProjectOwnerOrReadOnly, IsWorkspaceMember, user_is_owner_or_admin

from . import selectors
from .serializers import (
    DocumentationPageSerializer,
    PlaylistItemSerializer,
    PlaylistSerializer,
    PlaylistTheaterSerializer,
    StepGuideSerializer,
)
from .services.handlers import PlaylistItemService, PlaylistService, can_manage_playlist_sequence


class PlaylistViewSet(viewsets.ModelViewSet):
    serializer_class = PlaylistSerializer
    permission_classes = [IsWorkspaceMember, IsOwnerOrDelegatedEditor]
    owner_field = "owner"
    content_type = "playlist"
    filterset_fields = ["visibility", "owner"]
    search_fields = ["title", "description"]

    def get_queryset(self):
        return selectors.playlists_visible_to_user(self.request.user)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization, owner=self.request.user)

    def perform_update(self, serializer):
        if "visibility" in self.request.data and not user_is_owner_or_admin(
            self.request.user, serializer.instance, owner_field="owner"
        ):
            raise PermissionDenied("Only this playlist's owner or an admin can change its visibility.")
        serializer.save()

    @action(detail=True, methods=["get"])
    def theater(self, request, pk=None):
        """The Playlist Theater's bootstrap payload: the ordered clip queue
        with every clip's studio edit layers and step guides attached."""
        playlist = self.get_object()
        serializer = PlaylistTheaterSerializer(playlist, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(detail=True, methods=["put"], url_path="reorder")
    def reorder(self, request, pk=None):
        """Atomically applies a new clip order for this playlist."""
        playlist = selectors.playlist_by_pk_for_user(request.user, pk)
        if playlist is None:
            raise NotFound()
        if not can_manage_playlist_sequence(request.user, playlist):
            raise PermissionDenied("Only this playlist's owner, a Team Lead, or an admin can reorder it.")

        playlist = PlaylistService.reorder(playlist, request.data.get("ordered_clip_ids"))
        serializer = PlaylistTheaterSerializer(playlist, context=self.get_serializer_context())
        return Response(serializer.data)


class PlaylistItemViewSet(viewsets.ModelViewSet):
    serializer_class = PlaylistItemSerializer
    permission_classes = [IsWorkspaceMember]
    filterset_fields = ["playlist", "clip"]

    def get_queryset(self):
        return selectors.playlist_items_for_organization(self.request.user.organization_id)

    def perform_create(self, serializer):
        PlaylistItemService.append(serializer)


class DocumentationPageViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentationPageSerializer
    permission_classes = [IsWorkspaceMember, IsProjectOwnerOrReadOnly]
    filterset_fields = ["status", "visibility", "author"]
    search_fields = ["title", "content_markdown"]

    def get_queryset(self):
        return selectors.documentation_pages_for_organization(self.request.user.organization_id)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization, author=self.request.user)


class StepGuideViewSet(viewsets.ModelViewSet):
    serializer_class = StepGuideSerializer
    permission_classes = [IsWorkspaceMember]
    filterset_fields = ["clip"]

    def get_queryset(self):
        return selectors.step_guides_for_organization(self.request.user.organization_id)
