"""
File Introduction:
Module: studio.services.interfaces
Role: Protocol contracts for the AI Auto-Edit pipeline's transcription, silence-detection, script-refinement, and voice-synthesis stages.

Responsibilities:
- Defines the method signature each pipeline stage implementation must satisfy.
- Establishes the abstraction boundary between AutoEditPipeline and its concrete stage adapters.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Protocol, TypedDict


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


class TranscriberProtocol(Protocol):
    def transcribe(self, duration_seconds: Decimal) -> list[RawSegment]: ...


class SilenceDetectorProtocol(Protocol):
    def detect(self, duration_seconds: Decimal) -> list[SilenceRange]: ...


class ScriptRefinerProtocol(Protocol):
    def refine(
        self,
        raw_segments: list[RawSegment],
        mode: str,
        additional_context: str = "",
        custom_dictionary: list[str] | None = None,
    ) -> list[RefinedSegment]: ...


class AudioSynthesizerProtocol(Protocol):
    def synthesize(self, refined_segments: list[RefinedSegment]) -> bytes: ...
