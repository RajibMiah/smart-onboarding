from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from core.permissions import IsOwnerOrDelegatedEditor, IsWorkspaceMember, scoped_to_visible, user_is_owner_or_admin

from .models import Clip, MediaAsset
from .serializers import ClipSerializer, MediaAssetSerializer


class ClipViewSet(viewsets.ModelViewSet):
    serializer_class = ClipSerializer
    permission_classes = [IsWorkspaceMember, IsOwnerOrDelegatedEditor]
    owner_field = "author"
    content_type = "clip"
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filterset_fields = ["status", "visibility", "author"]
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "title", "duration_seconds"]

    def get_queryset(self):
        # Private-by-default: a draft/private clip is invisible to everyone
        # except its own author, a global admin (audit-level visibility), or
        # someone it's been explicitly shared with — `for_user` alone only
        # scoped by organization/tenant, with no visibility check at all.
        base = (
            Clip.objects.for_user(self.request.user)
            .select_related("author", "organization")
            .prefetch_related("assets")
        )
        return scoped_to_visible(
            base,
            self.request.user,
            owner_field="author",
            content_type="clip",
            public_visibility_value=Clip.Visibility.PUBLISHED,
        )

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization, author=self.request.user)

    def perform_update(self, serializer):
        # Changing visibility stays owner/admin-exclusive even for a
        # delegate `IsOwnerOrDelegatedEditor` otherwise lets edit this clip's
        # content — a can_edit invitee tweaking cuts/filters is a different
        # trust level than them unilaterally making a private clip public.
        if "visibility" in self.request.data and not user_is_owner_or_admin(
            self.request.user, serializer.instance, owner_field="author"
        ):
            raise PermissionDenied("Only this clip's owner or an admin can change its visibility.")
        serializer.save()

    @action(detail=True, methods=["get"])
    def watch(self, request, pk=None):
        """Single-clip counterpart to the Playlist Theater's `theater`
        action: the clip's full edit layers/step guides in one payload, plus
        enough playlist context for the Watch page's sidebar to decide
        between "sibling clip queue" and "standalone clip details" without a
        second round trip.
        """
        from collaboration.serializers import TheaterClipSerializer

        clip = self.get_object()
        data = TheaterClipSerializer(clip, context=self.get_serializer_context()).data

        # A clip can belong to more than one playlist — the earliest
        # membership is treated as its "home" playlist for this sidebar,
        # same "pick one, deterministically" tradeoff as deriving a user's
        # single displayed team from potentially-multiple memberships.
        playlist_item = clip.playlist_items.select_related("playlist").order_by("added_at").first()
        if playlist_item is not None:
            playlist = playlist_item.playlist
            siblings = playlist.items.select_related("clip").order_by("position")
            data["playlist_context"] = {
                "id": str(playlist.id),
                "title": playlist.title,
                "items": [
                    {
                        "id": str(item.clip_id),
                        "title": item.clip.title,
                        "duration_seconds": str(item.clip.duration_seconds),
                        "position": item.position,
                    }
                    for item in siblings
                ],
            }
        else:
            data["playlist_context"] = None

        data["related_clips"] = [
            {"id": str(related.id), "title": related.title, "duration_seconds": str(related.duration_seconds)}
            for related in self.get_queryset().filter(author_id=clip.author_id).exclude(id=clip.id).order_by("-created_at")[:5]
        ]
        return Response(data)


class MediaAssetViewSet(viewsets.ModelViewSet):
    """Workspace media bin: assets uploaded here exist independently of any
    `Clip` (see `MediaAsset.clip`) — the Studio's "Previous Medias" library."""

    serializer_class = MediaAssetSerializer
    permission_classes = [IsWorkspaceMember]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filterset_fields = ["asset_type", "status", "clip"]
    ordering_fields = ["created_at"]

    def get_queryset(self):
        return MediaAsset.objects.filter(organization_id=self.request.user.organization_id)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization, uploader=self.request.user)
