"""
File Introduction:
Module: studio.tasks
Role: Celery entry point for the AI Auto-Edit & Voiceover workflow.

Responsibilities:
- Builds the Auto-Edit pipeline and dispatches it as a background task.
- Bridges Celery's progress reporting to the pipeline's plain callback interface.
"""

from __future__ import annotations

from celery import shared_task

from .services.handlers import build_default_pipeline


@shared_task(bind=True)
def process_ai_auto_edit(self, clip_id: str, user_id: str, options: dict):
    pipeline = build_default_pipeline()
    return pipeline.run(
        clip_id,
        user_id,
        options,
        on_phase=lambda state, phase: self.update_state(state=state, meta={"phase": phase}),
    )
