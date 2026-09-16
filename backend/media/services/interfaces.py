"""
File Introduction:
Module: media.services.interfaces
Role: Protocol contracts for dispatching and polling the AI Auto-Edit job.

Responsibilities:
- Defines the method signature a job dispatcher adapter must satisfy.
- Defines the method signature a job status provider adapter must satisfy.
"""

from __future__ import annotations

from typing import Protocol


class AutoEditDispatcherProtocol(Protocol):
    def dispatch(self, clip_id: str, user_id: str, options: dict) -> str:
        """Launches the Auto-Edit pipeline and returns a job/task id."""
        ...


class AutoEditStatusProviderProtocol(Protocol):
    def status(self, task_id: str) -> dict:
        """Returns the current `{state, phase, ...}` status for a dispatched job."""
        ...
