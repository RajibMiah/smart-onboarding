"""
File Introduction:
Module: studio.services.handlers
Role: Domain services implementing the AI Auto-Edit pipeline's stages and orchestration.

Responsibilities:
- Provides mock and Ollama-backed implementations of each pipeline stage protocol.
- Orchestrates the pipeline end-to-end via `AutoEditPipeline` and persists its output.
- Wires the default stage implementations together via `build_default_pipeline`.
"""

from __future__ import annotations

import io
import json
import wave
from decimal import Decimal
from typing import Callable

import httpx
from django.conf import settings
from django.core.files.base import ContentFile

from media.models import Clip, MediaAsset

from .. import selectors
from ..models import Cut, TimelineTrack, TranscriptSegment
from .interfaces import (
    AudioSynthesizerProtocol,
    RawSegment,
    RefinedSegment,
    ScriptRefinerProtocol,
    SilenceDetectorProtocol,
    SilenceRange,
    TranscriberProtocol,
)

_MOCK_TRANSCRIPT_LINES = [
    "Now I'll open the settings panel to configure the workspace.",
    "Here you can see the main dashboard with recent activity.",
    "Next, click this button to start the export process.",
    "This section lets you review and confirm the changes.",
    "Finally, save your work and return to the overview screen.",
]

_SEGMENT_LENGTH_SECONDS = Decimal("4.0")

PhaseCallback = Callable[[str, str], None]


class MockTranscriber:
    """Whisper stand-in: splits the clip into fixed-length placeholder segments."""

    def transcribe(self, duration_seconds: Decimal) -> list[RawSegment]:
        segments: list[RawSegment] = []
        cursor = Decimal("0")
        index = 0
        while cursor < duration_seconds:
            end = min(cursor + _SEGMENT_LENGTH_SECONDS, duration_seconds)
            segments.append(
                {"start": cursor, "end": end, "text": _MOCK_TRANSCRIPT_LINES[index % len(_MOCK_TRANSCRIPT_LINES)]}
            )
            cursor = end
            index += 1
        return segments


class MockSilenceDetector:
    """ffmpeg silencedetect stand-in: a deterministic gap after every segment."""

    def detect(self, duration_seconds: Decimal) -> list[SilenceRange]:
        ranges: list[SilenceRange] = []
        cursor = _SEGMENT_LENGTH_SECONDS
        gap = Decimal("0.9")
        while cursor + gap < duration_seconds:
            ranges.append({"start": cursor, "end": cursor + gap})
            cursor += _SEGMENT_LENGTH_SECONDS + gap
        return ranges


class MockScriptRefiner:
    """Deterministic stand-in for script refinement."""

    def refine(
        self,
        raw_segments: list[RawSegment],
        mode: str,
        additional_context: str = "",
        custom_dictionary: list[str] | None = None,
    ) -> list[RefinedSegment]:
        prefix = {
            "auto_generate": "Step: ",
            "ai_voice_clone": "",
            "keep_original": "",
        }.get(mode, "")
        suffix = f" ({additional_context.strip()})" if additional_context.strip() else ""
        return [
            {"start": segment["start"], "end": segment["end"], "script_text": f"{prefix}{segment['text']}{suffix}"}
            for segment in raw_segments
        ]


class OllamaScriptRefiner:
    """Refines transcript segments into SOP script steps via a local Ollama instance."""

    def __init__(self, base_url: str | None = None, model: str = "qwen2.5:latest") -> None:
        self._base_url = base_url or settings.OLLAMA_BASE_URL
        self._model = model

    def refine(
        self,
        raw_segments: list[RawSegment],
        mode: str,
        additional_context: str = "",
        custom_dictionary: list[str] | None = None,
    ) -> list[RefinedSegment]:
        system_prompt = (
            "You are an expert technical documentation voiceover editor for APC. "
            "Your task is to take video audio transcription segments and rewrite them into clean, "
            "professional, and authoritative SOP instructions while preserving timing flow. "
            "Return ONLY a valid JSON array of objects with keys: 'start', 'end', 'script_text'."
        )

        user_prompt = (
            f"Mode: {mode}\n"
            f"User Context: {additional_context}\n"
            f"Custom Terms: {', '.join(custom_dictionary or [])}\n\n"
            f"Raw Transcription Segments:\n{json.dumps(raw_segments, default=str)}"
        )

        payload = {
            "model": self._model,
            "system": system_prompt,
            "prompt": user_prompt,
            "format": "json",
            "stream": False,
            "options": {"temperature": 0.3, "top_p": 0.9},
        }

        response = httpx.post(f"{self._base_url}/api/generate", json=payload, timeout=60.0)
        response.raise_for_status()
        result = response.json()
        return json.loads(result.get("response", "[]"))


class MockAudioSynthesizer:
    """TTS stand-in: writes a silent, valid mono 16kHz WAV spanning the refined segments' duration."""

    def synthesize(self, refined_segments: list[RefinedSegment]) -> bytes:
        sample_rate = 16000
        total_seconds = float(max((segment["end"] for segment in refined_segments), default=Decimal("0")))
        frame_count = int(sample_rate * total_seconds)

        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(b"\x00\x00" * frame_count)
        return buffer.getvalue()


class AutoEditPipeline:
    """Orchestrates the AI Auto-Edit workflow: runs the injected stage
    implementations in sequence and persists their output as timeline
    tracks/regions and a media asset."""

    def __init__(
        self,
        transcriber: TranscriberProtocol,
        silence_detector: SilenceDetectorProtocol,
        script_refiner: ScriptRefinerProtocol,
        audio_synthesizer: AudioSynthesizerProtocol,
    ) -> None:
        self._transcriber = transcriber
        self._silence_detector = silence_detector
        self._script_refiner = script_refiner
        self._audio_synthesizer = audio_synthesizer

    def run(self, clip_id: str, user_id: str, options: dict, on_phase: PhaseCallback | None = None) -> dict:
        def report(state: str, phase: str) -> None:
            if on_phase is not None:
                on_phase(state, phase)

        clip = selectors.clip_for_auto_edit(clip_id)
        duration = clip.duration_seconds

        report("TRANSCRIBING", "Transcribing...")
        raw_segments = self._transcriber.transcribe(duration)

        silence_ranges: list[SilenceRange] = []
        if options.get("shorten_silences"):
            silence_ranges = self._silence_detector.detect(duration)

        voiceover_mode = options["voiceover_mode"]
        refined_segments: list[RefinedSegment] | None = None
        if voiceover_mode != "keep_original":
            report("GENERATING_SCRIPT", "Ollama Generating Script...")
            custom_dictionary = options.get("custom_dictionary") if options.get("use_dictionary") else None
            refined_segments = self._script_refiner.refine(
                raw_segments, voiceover_mode, options.get("additional_context", ""), custom_dictionary
            )

        next_order = selectors.next_track_order(clip)
        result: dict = {"clip_id": str(clip.id), "mute_original_audio": False}

        if silence_ranges:
            next_order = self._persist_cuts(clip, next_order, silence_ranges, options, result)

        if refined_segments is not None:
            report("SYNTHESIZING_VOICE", "Synthesizing Voice...")
            self._persist_voiceover(clip, user_id, next_order, duration, raw_segments, refined_segments, result)
            result["mute_original_audio"] = voiceover_mode == "ai_voice_clone"

        report("READY", "Ready")
        return result

    def _persist_cuts(
        self,
        clip: Clip,
        next_order: int,
        silence_ranges: list[SilenceRange],
        options: dict,
        result: dict,
    ) -> int:
        cut_track = TimelineTrack.objects.create(clip=clip, track_type=TimelineTrack.TrackType.CUT, order=next_order)
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
        return next_order + 1

    def _persist_voiceover(
        self,
        clip: Clip,
        user_id: str,
        next_order: int,
        duration: Decimal,
        raw_segments: list[RawSegment],
        refined_segments: list[RefinedSegment],
        result: dict,
    ) -> None:
        audio_bytes = self._audio_synthesizer.synthesize(refined_segments)

        audio_track = TimelineTrack.objects.create(clip=clip, track_type=TimelineTrack.TrackType.AUDIO, order=next_order)

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


def build_default_pipeline() -> AutoEditPipeline:
    """Wires up the pipeline's default stage implementations per settings."""
    script_refiner: ScriptRefinerProtocol = MockScriptRefiner() if settings.AI_AUTO_EDIT_USE_MOCK else OllamaScriptRefiner()
    return AutoEditPipeline(
        transcriber=MockTranscriber(),
        silence_detector=MockSilenceDetector(),
        script_refiner=script_refiner,
        audio_synthesizer=MockAudioSynthesizer(),
    )
