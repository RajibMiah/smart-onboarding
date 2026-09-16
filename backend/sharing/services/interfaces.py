"""
File Introduction:
Module: sharing.services.interfaces
Role: Protocol contracts for the sharing app's outbound email and notification delivery.

Responsibilities:
- Defines the method signature an email delivery adapter must satisfy.
- Defines the method signature an in-app notification adapter must satisfy.
"""

from __future__ import annotations

from typing import Iterable, Protocol

from core.models import User


class EmailSenderProtocol(Protocol):
    def send(self, *, subject: str, message: str, recipient_list: list[str]) -> None: ...


class NotifierProtocol(Protocol):
    def notify(
        self,
        *,
        recipients: Iterable[User],
        sender: User,
        notification_type: str,
        title: str,
        message: str,
        action_url: str,
    ) -> None: ...
