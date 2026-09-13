from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator

from media.serializers import ClipSerializer
from studio.serializers import TimelineTrackSerializer

from .models import DocumentationPage, PageClipItem, Playlist, PlaylistItem, StepGuide


class PlaylistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlaylistItem
        fields = ["id", "playlist", "clip", "position", "added_at"]
        # `position` is server-assigned in `PlaylistItemViewSet.perform_create`
        # (always appends after the current max) — a client-supplied value
        # could collide with the (playlist, position) unique constraint.
        read_only_fields = ["id", "position", "added_at"]
        # DRF auto-generates a unique-together validator per model
        # UniqueConstraint, including (playlist, position) — but since
        # `position` is read-only, it would validate against the model
        # field's `default=0` before `perform_create` ever computes the real
        # value, rejecting every playlist's second item as a false-positive
        # collision with its first (both "true" position 0 at validation
        # time). Declaring validators explicitly keeps the one that's safe to
        # check up front (playlist+clip) and drops the other — the DB-level
        # UniqueConstraint still backstops position uniqueness for real.
        validators = [
            UniqueTogetherValidator(
                queryset=PlaylistItem.objects.all(),
                fields=["playlist", "clip"],
                message="This clip is already in that playlist.",
            )
        ]


class PlaylistSerializer(serializers.ModelSerializer):
    items = PlaylistItemSerializer(many=True, read_only=True)

    class Meta:
        model = Playlist
        fields = [
            "id",
            "organization",
            "owner",
            "title",
            "description",
            "cover_image_url",
            "visibility",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "organization", "owner", "created_at", "updated_at"]


class StepGuideSerializer(serializers.ModelSerializer):
    class Meta:
        model = StepGuide
        fields = [
            "id",
            "clip",
            "step_number",
            "timestamp_seconds",
            "title",
            "description_markdown",
            "snapshot_image_url",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class TheaterClipSerializer(ClipSerializer):
    """A clip as it plays inside the Playlist Theater: everything `ClipSerializer`
    already exposes (assets, filter_settings) plus its non-destructive edit
    tracks and step guides, so the theater view can hydrate playback and the
    documentation deck from one nested payload instead of N follow-up
    requests per clip."""

    tracks = TimelineTrackSerializer(many=True, read_only=True)
    step_guides = StepGuideSerializer(many=True, read_only=True)
    author_name = serializers.CharField(source="author.full_name", read_only=True)

    class Meta(ClipSerializer.Meta):
        fields = [*ClipSerializer.Meta.fields, "tracks", "step_guides", "author_name"]


class PlaylistTheaterItemSerializer(serializers.ModelSerializer):
    clip = TheaterClipSerializer(read_only=True)

    class Meta:
        model = PlaylistItem
        fields = ["id", "clip", "position"]


class PlaylistTheaterSerializer(serializers.ModelSerializer):
    """Full runbook payload for `GET /playlists/<id>/theater/` — the ordered
    clip queue with each clip's complete studio edit layers already attached.
    """

    items = PlaylistTheaterItemSerializer(many=True, read_only=True)
    owner_name = serializers.CharField(source="owner.full_name", read_only=True)
    # The Playlist model has no department/team of its own (only an
    # organization + owner) — the spec's "Department/Team" header badges are
    # derived from whichever team the owner belongs to, the same lookup
    # `OrgMemberSerializer.get_team`/`get_department` already uses elsewhere.
    owner_department = serializers.SerializerMethodField()
    owner_team = serializers.SerializerMethodField()

    class Meta:
        model = Playlist
        fields = [
            "id",
            "organization",
            "owner",
            "owner_name",
            "owner_department",
            "owner_team",
            "title",
            "description",
            "visibility",
            "items",
            "created_at",
            "updated_at",
        ]

    def get_owner_team(self, obj: Playlist) -> str | None:
        membership = obj.owner.team_memberships.select_related("team").first()
        return membership.team.name if membership else None

    def get_owner_department(self, obj: Playlist) -> str | None:
        membership = obj.owner.team_memberships.select_related("team__department").first()
        return membership.team.department.name if membership and membership.team.department else None


class PageClipItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PageClipItem
        fields = ["id", "page", "clip", "step_number", "step_note"]
        read_only_fields = ["id"]


class DocumentationPageSerializer(serializers.ModelSerializer):
    clip_items = PageClipItemSerializer(many=True, read_only=True)

    class Meta:
        model = DocumentationPage
        fields = [
            "id",
            "organization",
            "author",
            "title",
            "slug",
            "content_markdown",
            "section_count",
            "status",
            "visibility",
            "clip_items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "organization", "author", "created_at", "updated_at"]
