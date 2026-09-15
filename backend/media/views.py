from celery.result import AsyncResult
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from core.permissions import IsOwnerOrDelegatedEditor, IsWorkspaceMember, scoped_to_visible, user_is_owner_or_admin
from studio.serializers import AutoEditRequestSerializer
from studio.tasks import process_ai_auto_edit

from .models import Clip, MediaAsset
from .serializers import ClipSerializer, MediaAssetSerializer

# Celery task phase -> the Studio drawer's four named pipeline steps
# (AutoEditPanel.tsx's progress banner). PENDING/SUCCESS/FAILURE are Celery's
# own built-in states; the rest are custom states studio/tasks.py reports via
# `self.update_state(...)` as the pipeline progresses.
_AUTO_EDIT_PHASE_BY_STATE = {
    "PENDING": "Queued...",
    "TRANSCRIBING": "Transcribing...",
    "GENERATING_SCRIPT": "Ollama Generating Script...",
    "SYNTHESIZING_VOICE": "Synthesizing Voice...",
    "READY": "Ready",
    "SUCCESS": "Ready",
    "FAILURE": "Failed",
}


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

    @action(detail=True, methods=["post"], url_path="auto-edit")
    def auto_edit(self, request, pk=None):
        """Launches the AI Auto-Edit & Voiceover pipeline (studio/tasks.py)
        for this clip in the background and returns immediately — this
        clip must already be saved to the backend (a fresh, never-saved
        recording has no `id` here yet; the Studio drawer surfaces that as
        "save this project first" rather than calling this)."""
        clip = self.get_object()
        serializer = AutoEditRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        options = dict(serializer.validated_data)
        # DecimalField survives inside this process, but Celery's task
        # message is JSON over the wire — stringify explicitly rather than
        # relying on however kombu's encoder happens to round-trip Decimal.
        options["silence_speed_multiplier"] = str(options["silence_speed_multiplier"])

        task = process_ai_auto_edit.delay(str(clip.id), str(request.user.id), options)
        return Response({"task_id": task.id, "status": "processing"}, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["get"], url_path="ai-status")
    def ai_status(self, request, pk=None):
        """Polled by `useAutoEditJob` — `task_id` comes from `auto_edit`'s
        response. Scoped under this clip's own detail route (permission-
        checked via `get_object()`) even though the actual state lookup is
        keyed by `task_id`, not `pk`, so one workspace member can't poll
        another's job by guessing a task id."""
        self.get_object()
        task_id = request.query_params.get("task_id")
        if not task_id:
            return Response({"detail": "task_id query parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        result = AsyncResult(task_id)
        state = result.state
        payload = {"task_id": task_id, "state": state, "phase": _AUTO_EDIT_PHASE_BY_STATE.get(state, state)}
        if state == "SUCCESS":
            payload["result"] = result.result
        elif state == "FAILURE":
            payload["error"] = str(result.info)
        elif isinstance(result.info, dict):
            # A custom in-progress state's `meta` (studio/tasks.py's
            # `self.update_state(..., meta={"phase": ...})`) is the more
            # specific, model-authored wording over the static table above.
            payload["phase"] = result.info.get("phase", payload["phase"])
        return Response(payload)


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
