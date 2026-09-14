"""AI Auto-Edit pipeline: transcription, script refinement (Ollama), and
voice synthesis — behind swappable functions rather than one monolithic
client class, so `studio/tasks.py` can call each stage without knowing
whether it's talking to a real model or a stand-in.

Every stage below defaults to a deterministic mock: this stack has no
faster-whisper, Ollama, or TTS engine installed (see docker-compose.yml —
only `redis` and a `celery_worker` were added for this feature, not a model
server). `AI_AUTO_EDIT_USE_MOCK` (settings, default `True`) gates only the
script-refinement stage, since that one has a real, working implementation
below (`refine_transcript_with_ollama`) ready for whenever an Ollama
instance is actually reachable at `OLLAMA_BASE_URL`. Transcription and
silence detection have no real implementation here yet — they always run
the placeholder path — because that requires ffmpeg + a real ASR model in
the backend image, a separate, larger change than this pass covers.
"""

from __future__ import annotations

import io
import json
import wave
from decimal import Decimal
from typing import TypedDict

import httpx
from django.conf import settings


class RawSegment(TypedDict):
    start: Decimal
    end: Decimal
    text: str


class RefinedSegment(TypedDict):
    start: Decimal
    end: Decimal
    script_text: str


class SilenceRange(TypedDict):
    start: Decimal
    end: Decimal


# Placeholder transcript lines, cycled to fill however many segments a clip's
# duration produces — clearly synthetic text rather than empty strings, so a
# transcript panel built against this later has something legible to render.
_MOCK_TRANSCRIPT_LINES = [
    "Now I'll open the settings panel to configure the workspace.",
    "Here you can see the main dashboard with recent activity.",
    "Next, click this button to start the export process.",
    "This section lets you review and confirm the changes.",
    "Finally, save your work and return to the overview screen.",
]

_SEGMENT_LENGTH_SECONDS = Decimal("4.0")


def transcribe_clip(duration_seconds: Decimal) -> list[RawSegment]:
    """Whisper stand-in: splits the clip into fixed-length segments with
    placeholder text. Swap for a real `faster-whisper` call once one is
    installed — same return shape (start/end in seconds, text)."""
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


def detect_silences(duration_seconds: Decimal) -> list[SilenceRange]:
    """`ffmpeg silencedetect=noise=-30dB:d=0.8` stand-in: a deterministic
    0.9s gap after every segment, leaving genuine speech untouched at either
    end. Swap for a real ffmpeg subprocess call once ffmpeg is in the image —
    same return shape."""
    ranges: list[SilenceRange] = []
    cursor = _SEGMENT_LENGTH_SECONDS
    gap = Decimal("0.9")
    while cursor + gap < duration_seconds:
        ranges.append({"start": cursor, "end": cursor + gap})
        cursor += _SEGMENT_LENGTH_SECONDS + gap
    return ranges


def _mock_refine_transcript(
    raw_segments: list[RawSegment],
    mode: str,
    additional_context: str,
    custom_dictionary: list[str],
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


def refine_transcript_with_ollama(
    raw_segments: list[RawSegment],
    mode: str,
    additional_context: str = "",
    custom_dictionary: list[str] | None = None,
    model: str = "qwen2.5:latest",
) -> list[RefinedSegment]:
    """Sends raw transcript segments to a local Ollama instance to clean,
    formalize, or synthesize procedural SOP script steps with time anchors.
    Real, working code — only reachable when `AI_AUTO_EDIT_USE_MOCK=False`
    and an Ollama server is actually running at `settings.OLLAMA_BASE_URL`.
    """
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
        "model": model,
        "system": system_prompt,
        "prompt": user_prompt,
        "format": "json",
        "stream": False,
        "options": {"temperature": 0.3, "top_p": 0.9},
    }

    response = httpx.post(f"{settings.OLLAMA_BASE_URL}/api/generate", json=payload, timeout=60.0)
    response.raise_for_status()
    result = response.json()
    return json.loads(result.get("response", "[]"))


def refine_transcript(
    raw_segments: list[RawSegment],
    mode: str,
    additional_context: str = "",
    custom_dictionary: list[str] | None = None,
) -> list[RefinedSegment]:
    """Dispatches to the mock or the real Ollama client per `AI_AUTO_EDIT_USE_MOCK`."""
    if settings.AI_AUTO_EDIT_USE_MOCK:
        return _mock_refine_transcript(raw_segments, mode, additional_context, custom_dictionary or [])
    return refine_transcript_with_ollama(raw_segments, mode, additional_context, custom_dictionary)


def synthesize_voice(refined_segments: list[RefinedSegment]) -> bytes:
    """TTS stand-in: writes a real, valid *silent* mono 16kHz WAV spanning
    the refined segments' total duration via the stdlib `wave` module — no
    TTS engine installed yet, but this produces an actual playable audio
    file end-to-end, so the rest of the pipeline (upload, track hydration,
    frontend playback) is genuinely exercised rather than faked at the last
    step. Swap for a real Kokoro/Piper/XTTS call once one is installed —
    same return type (raw WAV bytes)."""
    sample_rate = 16000
    total_seconds = float(max((segment["end"] for segment in refined_segments), default=Decimal("0")))
    frame_count = int(sample_rate * total_seconds)

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)  # 16-bit PCM
        wav_file.setframerate(sample_rate)
        # Silence is just zeroed samples — two zero bytes per 16-bit frame,
        # no need to go through struct.pack for something this uniform.
        wav_file.writeframes(b"\x00\x00" * frame_count)
    return buffer.getvalue()
