from rest_framework import serializers

from .models import BlurRegion, Cut, TextOverlay, TimelineTrack, ZoomRegion


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
        fields = ["id", "track", "x", "y", "width", "height", "scale_factor", "start_time", "end_time"]
        read_only_fields = ["id"]


class BlurRegionSerializer(TimedRegionSerializer):
    class Meta:
        model = BlurRegion
        fields = ["id", "track", "x", "y", "width", "height", "shape", "blur_radius", "start_time", "end_time"]
        read_only_fields = ["id"]


class TextOverlaySerializer(TimedRegionSerializer):
    class Meta:
        model = TextOverlay
        fields = [
            "id",
            "track",
            "content",
            "position_x",
            "position_y",
            "font_size",
            "color",
            "background_color",
            "start_time",
            "end_time",
        ]
        read_only_fields = ["id"]


class CutSerializer(TimedRegionSerializer):
    class Meta:
        model = Cut
        fields = ["id", "track", "cut_type", "speed_multiplier", "start_time", "end_time"]
        read_only_fields = ["id"]

    def validate(self, attrs: dict) -> dict:
        attrs = super().validate(attrs)
        cut_type = attrs.get("cut_type", getattr(self.instance, "cut_type", None))
        speed_multiplier = attrs.get("speed_multiplier", getattr(self.instance, "speed_multiplier", None))
        if cut_type == Cut.CutType.SILENCE_SPEEDUP and not speed_multiplier:
            raise serializers.ValidationError("speed_multiplier is required for a silence_speedup cut.")
        return attrs


class TimelineTrackSerializer(serializers.ModelSerializer):
    zoom_regions = ZoomRegionSerializer(many=True, read_only=True)
    blur_regions = BlurRegionSerializer(many=True, read_only=True)
    text_overlays = TextOverlaySerializer(many=True, read_only=True)
    cuts = CutSerializer(many=True, read_only=True)

    class Meta:
        model = TimelineTrack
        fields = [
            "id",
            "clip",
            "track_type",
            "order",
            "zoom_regions",
            "blur_regions",
            "text_overlays",
            "cuts",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
