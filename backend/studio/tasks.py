"""Celery task pipeline for the AI Auto-Edit & Voiceover workflow.

No `AutoEditJob` model: Celery's own result backend (Redis, see
config/celery.py) already tracks a task's state and return value keyed by
task id, and `self.update_state(...)` lets this task report the four named
phases the Studio drawer polls for (`ClipViewSet.ai_status`, media/views.py)
— a DB row would only duplicate what Celery already stores, for data that's
disposable once the job finishes and its results land on the timeline.
"""

from __future__ import annotations

from decimal import Decimal

from celery import shared_task
from django.core.files.base import ContentFile
from django.db.models import Max

from media.models import Clip, MediaAsset

from . import services
from .models import Cut, TimelineTrack, TranscriptSegment


@shared_task(bind=True)
def process_ai_auto_edit(self, clip_id: str, user_id: str, options: dict):
    clip = Clip.objects.select_related("organization").get(id=clip_id)
    duration = clip.duration_seconds

    self.update_state(state="TRANSCRIBING", meta={"phase": "Transcribing..."})
    raw_segments = services.transcribe_clip(duration)

    silence_ranges = []
    if options.get("shorten_silences"):
        silence_ranges = services.detect_silences(duration)

    voiceover_mode = options["voiceover_mode"]
    refined_segments = None
    if voiceover_mode != "keep_original":
        self.update_state(state="GENERATING_SCRIPT", meta={"phase": "Ollama Generating Script..."})
        custom_dictionary = options.get("custom_dictionary") if options.get("use_dictionary") else None
        refined_segments = services.refine_transcript(
            raw_segments, voiceover_mode, options.get("additional_context", ""), custom_dictionary
        )

    # Additive, not destructive: unlike Review's "Done" (which wipes and
    # recreates every track on each save), Auto-Edit only ever appends new
    # tracks after whatever order this clip's existing tracks already use —
    # it must never delete zoom/blur/text/cut work already on the timeline.
    next_order = (TimelineTrack.objects.filter(clip=clip).aggregate(Max("order"))["order__max"] or 0) + 1

    result: dict = {"clip_id": str(clip.id), "mute_original_audio": False}

    if silence_ranges:
        cut_track = TimelineTrack.objects.create(clip=clip, track_type=TimelineTrack.TrackType.CUT, order=next_order)
        next_order += 1
        strategy = options.get("silence_strategy", "speed_up")
        speed_multiplier = Decimal(str(options.get("silence_speed_multiplier") or "2"))
        for silence_range in silence_ranges:
            if strategy == "cut":
                Cut.objects.create(
                    track=cut_track,
                    cut_type=Cut.CutType.CUT,
                    start_time=silence_range["start"],
                    end_time=silence_range["end"],
                )
            else:
                Cut.objects.create(
                    track=cut_track,
                    cut_type=Cut.CutType.SILENCE_SPEEDUP,
                    speed_multiplier=speed_multiplier,
                    start_time=silence_range["start"],
                    end_time=silence_range["end"],
                )
        result["cut_track_id"] = str(cut_track.id)
        result["cut_count"] = len(silence_ranges)

    if refined_segments is not None:
        self.update_state(state="SYNTHESIZING_VOICE", meta={"phase": "Synthesizing Voice..."})
        audio_bytes = services.synthesize_voice(refined_segments)

        audio_track = TimelineTrack.objects.create(clip=clip, track_type=TimelineTrack.TrackType.AUDIO, order=next_order)
        next_order += 1

        raw_text_by_span = {(segment["start"], segment["end"]): segment["text"] for segment in raw_segments}
        for segment in refined_segments:
            TranscriptSegment.objects.create(
                track=audio_track,
                original_text=raw_text_by_span.get((segment["start"], segment["end"]), ""),
                script_text=segment["script_text"],
                start_time=segment["start"],
                end_time=segment["end"],
            )

        audio_asset = MediaAsset.objects.create(
            organization=clip.organization,
            uploader_id=user_id,
            clip=clip,
            asset_type=MediaAsset.AssetType.AUDIO,
            mime_type="audio/wav",
            duration=float(duration),
            file_size_bytes=len(audio_bytes),
            status=MediaAsset.Status.READY,
        )
        audio_asset.file.save(f"ai-voiceover-{clip.id}.wav", ContentFile(audio_bytes), save=True)

        result["audio_track_id"] = str(audio_track.id)
        result["audio_asset_id"] = str(audio_asset.id)
        # Only a synthesized replacement voice competes with the original
        # audio — "Auto-Generate Explanation" narrates *over* the recording,
        # so muting it would silence the very thing being explained.
        result["mute_original_audio"] = voiceover_mode == "ai_voice_clone"

    self.update_state(state="READY", meta={"phase": "Ready"})
    return result
