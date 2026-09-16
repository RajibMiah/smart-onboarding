"""
File Introduction:
Module: collaboration.serializers
Role: Schema validation and payload formatting for playlists, documentation pages, and step guides.

Responsibilities:
- Validates and shapes Playlist, PlaylistItem, DocumentationPage, PageClipItem, and StepGuide payloads.
- Composes the Playlist Theater's nested clip/track/step-guide payload (TheaterClipSerializer,
  PlaylistTheaterSerializer).
"""

from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator

from core.permissions import user_can_edit_object, user_is_owner_or_admin
from media.serializers import ClipSerializer
from studio.serializers import TimelineTrackSerializer

from .models import DocumentationPage, PageClipItem, Playlist, PlaylistItem, StepGuide


class PlaylistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlaylistItem
        fields = "__all__"
        read_only_fields = ["id", "position", "added_at"]

        validators = [
            UniqueTogetherValidator(
                queryset=PlaylistItem.objects.all(),
                fields=["playlist", "clip"],
                message="This clip is already in that playlist.",
            )
        ]


class PlaylistSerializer(serializers.ModelSerializer):
    items = PlaylistItemSerializer(many=True, read_only=True)
    can_edit = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()

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
            "can_edit",
            "is_owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "organization", "owner", "created_at", "updated_at"]

    def get_can_edit(self, obj: Playlist) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return user_can_edit_object(request.user, obj, owner_field="owner", content_type="playlist")

    def get_is_owner(self, obj: Playlist) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return user_is_owner_or_admin(request.user, obj, owner_field="owner")


class StepGuideSerializer(serializers.ModelSerializer):
    class Meta:
        model = StepGuide
        fields = "__all__"
        read_only_fields = ["id", "created_at"]


class TheaterClipSerializer(ClipSerializer):
    """A clip as it plays inside the Playlist Theater: `ClipSerializer`'s
    fields plus its edit tracks and step guides in one nested payload."""

    tracks = TimelineTrackSerializer(many=True, read_only=True)
    step_guides = StepGuideSerializer(many=True, read_only=True)
    author_name = serializers.CharField(source="author.full_name", read_only=True)
    author_avatar_url = serializers.SerializerMethodField()
    author_department = serializers.SerializerMethodField()
    author_team = serializers.SerializerMethodField()

    class Meta(ClipSerializer.Meta):
        fields = [
            *ClipSerializer.Meta.fields,
            "tracks",
            "step_guides",
            "author_name",
            "author_avatar_url",
            "author_department",
            "author_team",
        ]

    def get_author_avatar_url(self, obj) -> str:
        author = obj.author
        if author.avatar:
            request = self.context.get("request")
            return request.build_absolute_uri(author.avatar.url) if request else author.avatar.url
        return author.avatar_url

    def get_author_team(self, obj) -> str | None:
        membership = obj.author.team_memberships.select_related("team").first()
        return membership.team.name if membership else None

    def get_author_department(self, obj) -> str | None:
        membership = obj.author.team_memberships.select_related("team__department").first()
        return membership.team.department.name if membership and membership.team.department else None


class PlaylistTheaterItemSerializer(serializers.ModelSerializer):
    clip = TheaterClipSerializer(read_only=True)

    class Meta:
        model = PlaylistItem
        fields = ["id", "clip", "position"]


class PlaylistTheaterSerializer(serializers.ModelSerializer):
    """Full runbook payload for `GET /playlists/<id>/theater/`: the ordered
    clip queue with each clip's complete studio edit layers attached."""

    items = PlaylistTheaterItemSerializer(many=True, read_only=True)
    owner_name = serializers.CharField(source="owner.full_name", read_only=True)

    owner_department = serializers.SerializerMethodField()
    owner_team = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()

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
            "can_edit",
            "is_owner",
            "created_at",
            "updated_at",
        ]

    def get_can_edit(self, obj: Playlist) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return user_can_edit_object(request.user, obj, owner_field="owner", content_type="playlist")

    def get_is_owner(self, obj: Playlist) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return user_is_owner_or_admin(request.user, obj, owner_field="owner")

    def get_owner_team(self, obj: Playlist) -> str | None:
        membership = obj.owner.team_memberships.select_related("team").first()
        return membership.team.name if membership else None

    def get_owner_department(self, obj: Playlist) -> str | None:
        membership = obj.owner.team_memberships.select_related("team__department").first()
        return membership.team.department.name if membership and membership.team.department else None


class PageClipItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PageClipItem
        fields = "__all__"
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
