"""
File Introduction:
Module: studio.serializers
Role: Schema validation and payload formatting for timeline tracks and their timed regions.

Responsibilities:
- Validates and shapes zoom/blur/text/cut/transcript region payloads.
- Validates the Auto-Edit request payload consumed by the Celery pipeline.
"""

from rest_framework import serializers

from .models import BlurRegion, Cut, TextOverlay, TimelineTrack, TranscriptSegment, ZoomRegion


class TimedRegionSerializer(serializers.ModelSerializer):
    """Shared start/end validation for zoom, blur, and text overlay serializers."""

    def validate(self, attrs: dict) -> dict:
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start is not None and end is not None and start >= end:
            raise serializers.ValidationError("end_time must be greater than start_time.")
        return attrs


class ZoomRegionSerializer(TimedRegionSerializer):
    class Meta:
        model = ZoomRegion
        fields = "__all__"
        read_only_fields = ["id"]


class BlurRegionSerializer(TimedRegionSerializer):
    class Meta:
        model = BlurRegion
        fields = "__all__"
        read_only_fields = ["id"]


class TextOverlaySerializer(TimedRegionSerializer):
    class Meta:
        model = TextOverlay
        fields = "__all__"
        read_only_fields = ["id"]


class CutSerializer(TimedRegionSerializer):
    class Meta:
        model = Cut
        fields = "__all__"
        read_only_fields = ["id"]

    def validate(self, attrs: dict) -> dict:
        attrs = super().validate(attrs)
        cut_type = attrs.get("cut_type", getattr(self.instance, "cut_type", None))
        speed_multiplier = attrs.get("speed_multiplier", getattr(self.instance, "speed_multiplier", None))
        if cut_type == Cut.CutType.SILENCE_SPEEDUP and not speed_multiplier:
            raise serializers.ValidationError("speed_multiplier is required for a silence_speedup cut.")
        return attrs


class TranscriptSegmentSerializer(TimedRegionSerializer):
    class Meta:
        model = TranscriptSegment
        fields = "__all__"
        read_only_fields = ["id"]


class AutoEditRequestSerializer(serializers.Serializer):
    """Validates the options payload for `POST /clips/<id>/auto-edit/` —
    Celery task parameters, not fields on a persisted model."""

    voiceover_mode = serializers.ChoiceField(choices=["auto_generate", "ai_voice_clone", "keep_original"])
    additional_context = serializers.CharField(required=False, allow_blank=True, default="")
    use_dictionary = serializers.BooleanField(required=False, default=False)
    custom_dictionary = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    shorten_silences = serializers.BooleanField(required=False, default=False)
    silence_strategy = serializers.ChoiceField(choices=["cut", "speed_up"], required=False, default="speed_up")
    silence_speed_multiplier = serializers.DecimalField(max_digits=4, decimal_places=2, required=False, default=2)

    def validate(self, attrs: dict) -> dict:
        if attrs.get("voiceover_mode") == "keep_original" and not attrs.get("shorten_silences"):
            raise serializers.ValidationError(
                "Keeping the original audio with silence-shortening off leaves nothing for Auto-edit to do."
            )
        return attrs


class TimelineTrackSerializer(serializers.ModelSerializer):
    zoom_regions = ZoomRegionSerializer(many=True, read_only=True)
    blur_regions = BlurRegionSerializer(many=True, read_only=True)
    text_overlays = TextOverlaySerializer(many=True, read_only=True)
    cuts = CutSerializer(many=True, read_only=True)
    transcript_segments = TranscriptSegmentSerializer(many=True, read_only=True)

    class Meta:
        model = TimelineTrack
        fields = "__all__"
        read_only_fields = ["id", "created_at"]
