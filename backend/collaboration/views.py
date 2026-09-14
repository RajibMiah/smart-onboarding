from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from core.models import SystemRoleTier
from core.permissions import (
    IsOwnerOrDelegatedEditor,
    IsProjectOwnerOrReadOnly,
    IsWorkspaceMember,
    scoped_to_visible,
    user_has_share_capability,
    user_is_owner_or_admin,
)

from .models import DocumentationPage, Playlist, PlaylistItem, StepGuide
from .serializers import (
    DocumentationPageSerializer,
    PlaylistItemSerializer,
    PlaylistSerializer,
    PlaylistTheaterSerializer,
    StepGuideSerializer,
)


def _can_manage_playlist_sequence(user, playlist: Playlist) -> bool:
    """Reordering is deliberately broader than plain ownership: the owner, a
    global admin, or anyone holding an active `can_reorder` grant via a
    `SharedContent` row — independent of `can_edit`, since the Share
    Management dashboard lets a creator toggle each capability separately.
    Creators/Content Managers/Team Leads get it too even without an explicit
    share, matching those roles' existing reach elsewhere in the app.
    """
    if user_has_share_capability(user, playlist, owner_field="owner", content_type="playlist", capability="can_reorder"):
        return True
    membership = getattr(user, "membership", None)
    if membership is None:
        return False
    if membership.is_creator or membership.is_content_manager:
        return True
    return membership.role_tier == SystemRoleTier.TEAM_LEAD


class PlaylistViewSet(viewsets.ModelViewSet):
    serializer_class = PlaylistSerializer
    permission_classes = [IsWorkspaceMember, IsOwnerOrDelegatedEditor]
    owner_field = "owner"
    content_type = "playlist"
    filterset_fields = ["visibility", "owner"]
    search_fields = ["title", "description"]

    def get_queryset(self):
        # Same private-by-default rule as ClipViewSet: a private playlist is
        # invisible outside its owner, a global admin, and anyone it's been
        # explicitly shared with. `theater`/`reorder` below both go through
        # this too, so a user who can't see a playlist can't play or resequence
        # it either.
        base = Playlist.objects.for_user(self.request.user).prefetch_related("items")
        return scoped_to_visible(
            base,
            self.request.user,
            owner_field="owner",
            content_type="playlist",
            public_visibility_value=Playlist.Visibility.PUBLIC,
        )

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization, owner=self.request.user)

    def perform_update(self, serializer):
        # Same owner/admin-exclusive rule as ClipViewSet: a can_edit delegate
        # may rename/restructure a playlist but not unilaterally change its
        # visibility.
        if "visibility" in self.request.data and not user_is_owner_or_admin(
            self.request.user, serializer.instance, owner_field="owner"
        ):
            raise PermissionDenied("Only this playlist's owner or an admin can change its visibility.")
        serializer.save()

    @action(detail=True, methods=["get"])
    def theater(self, request, pk=None):
        """The Playlist Theater's single bootstrap payload: the ordered clip
        queue with every clip's full studio edit layers and step guides
        already attached, so the player never has to fetch each clip and its
        timeline tracks one-by-one."""
        playlist = self.get_object()
        serializer = PlaylistTheaterSerializer(playlist, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(detail=True, methods=["put"], url_path="reorder")
    def reorder(self, request, pk=None):
        """Atomically applies a new clip order. `get_object()` is skipped in
        favor of the plain workspace-scoped queryset lookup + the broader
        `_can_manage_playlist_sequence` check above — `IsProjectOwnerOrReadOnly`
        would otherwise block every non-owner Creator/Lead/Admin this action
        is meant to allow."""
        playlist = self.get_queryset().filter(pk=pk).first()
        if playlist is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if not _can_manage_playlist_sequence(request.user, playlist):
            raise PermissionDenied("Only this playlist's owner, a Team Lead, or an admin can reorder it.")

        ordered_clip_ids = request.data.get("ordered_clip_ids")
        if not isinstance(ordered_clip_ids, list) or not ordered_clip_ids:
            return Response(
                {"detail": "ordered_clip_ids must be a non-empty list of clip ids."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        items = list(playlist.items.all())
        items_by_clip_id = {str(item.clip_id): item for item in items}
        if set(items_by_clip_id) != {str(clip_id) for clip_id in ordered_clip_ids}:
            return Response(
                {"detail": "ordered_clip_ids must include exactly this playlist's current clips, no more and no fewer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            # Two-phase write: bump every item to a guaranteed-unique high
            # position first. Writing final positions directly, one row at a
            # time, risks a mid-loop collision with the (playlist, position)
            # unique constraint whenever an item hasn't reached its new slot
            # yet but another item is already being moved into it.
            for offset, item in enumerate(items):
                PlaylistItem.objects.filter(pk=item.pk).update(position=10_000 + offset)
            for index, clip_id in enumerate(ordered_clip_ids):
                PlaylistItem.objects.filter(pk=items_by_clip_id[str(clip_id)].pk).update(position=index)

        playlist.refresh_from_db()
        serializer = PlaylistTheaterSerializer(playlist, context=self.get_serializer_context())
        return Response(serializer.data)


class PlaylistItemViewSet(viewsets.ModelViewSet):
    serializer_class = PlaylistItemSerializer
    permission_classes = [IsWorkspaceMember]
    filterset_fields = ["playlist", "clip"]

    def get_queryset(self):
        return PlaylistItem.objects.filter(playlist__organization_id=self.request.user.organization_id)

    def perform_create(self, serializer):
        # `position` is server-assigned, not client-supplied — always append
        # after every existing item in this playlist. `select_for_update`
        # serializes concurrent adds to the same playlist so two simultaneous
        # requests can't both read the same max() and collide on one slot,
        # which the (playlist, position) unique constraint would otherwise reject.
        playlist = serializer.validated_data["playlist"]
        with transaction.atomic():
            existing = PlaylistItem.objects.select_for_update().filter(playlist=playlist)
            max_position = existing.order_by("-position").values_list("position", flat=True).first()
            next_position = 0 if max_position is None else max_position + 1
            serializer.save(position=next_position)


class DocumentationPageViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentationPageSerializer
    permission_classes = [IsWorkspaceMember, IsProjectOwnerOrReadOnly]
    filterset_fields = ["status", "visibility", "author"]
    search_fields = ["title", "content_markdown"]

    def get_queryset(self):
        return DocumentationPage.objects.filter(
            organization_id=self.request.user.organization_id
        ).prefetch_related("clip_items")

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization, author=self.request.user)


class StepGuideViewSet(viewsets.ModelViewSet):
    serializer_class = StepGuideSerializer
    permission_classes = [IsWorkspaceMember]
    filterset_fields = ["clip"]

    def get_queryset(self):
        return StepGuide.objects.filter(clip__organization_id=self.request.user.organization_id)
