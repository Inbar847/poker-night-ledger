"""
Structured realtime event builders — Stage 5.

Every event shares the same envelope:

    {
        "type":      "<event_type>",   # stable, dot-separated name
        "game_id":   "<uuid>",
        "timestamp": "<ISO-8601 UTC>",
        "payload":   { ... }           # event-specific fields
    }

Event catalogue
---------------
game.participant_joined  — a new participant was added to the game
game.started             — game moved from lobby → active
game.closed              — game moved from active → closed
buyin.created            — a buy-in record was created
buyin.updated            — a buy-in record was updated
buyin.deleted            — a buy-in record was deleted
expense.created          — an expense record was created
expense.updated          — an expense record was updated
expense.deleted          — an expense record was deleted
final_stack.updated      — a participant's final stack was upserted
settlement.updated       — triggered when the game closes and settlement is available
"""

import uuid
from datetime import datetime, timezone
from typing import Any


def _envelope(event_type: str, game_id: uuid.UUID, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": event_type,
        "game_id": str(game_id),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "payload": payload,
    }


# ---------------------------------------------------------------------------
# Game lifecycle events
# ---------------------------------------------------------------------------


def participant_joined(game_id: uuid.UUID, participant: dict[str, Any]) -> dict[str, Any]:
    """Emitted when a registered user or guest is added to the game."""
    return _envelope("game.participant_joined", game_id, {"participant": participant})


def game_started(game_id: uuid.UUID) -> dict[str, Any]:
    """Emitted when the dealer starts the game (lobby → active)."""
    return _envelope("game.started", game_id, {})


def game_closed(game_id: uuid.UUID) -> dict[str, Any]:
    """Emitted when the dealer closes the game (active → closed)."""
    return _envelope("game.closed", game_id, {})


def settlement_updated(game_id: uuid.UUID) -> dict[str, Any]:
    """Emitted after game close to signal that settlement data is ready."""
    return _envelope("settlement.updated", game_id, {})


# ---------------------------------------------------------------------------
# Buy-in events
# ---------------------------------------------------------------------------


def buyin_created(game_id: uuid.UUID, buy_in: dict[str, Any]) -> dict[str, Any]:
    return _envelope("buyin.created", game_id, {"buy_in": buy_in})


def buyin_updated(game_id: uuid.UUID, buy_in: dict[str, Any]) -> dict[str, Any]:
    return _envelope("buyin.updated", game_id, {"buy_in": buy_in})


def buyin_deleted(game_id: uuid.UUID, buy_in_id: uuid.UUID) -> dict[str, Any]:
    return _envelope("buyin.deleted", game_id, {"buy_in_id": str(buy_in_id)})


# ---------------------------------------------------------------------------
# Expense events
# ---------------------------------------------------------------------------


def expense_created(game_id: uuid.UUID, expense: dict[str, Any]) -> dict[str, Any]:
    return _envelope("expense.created", game_id, {"expense": expense})


def expense_updated(game_id: uuid.UUID, expense: dict[str, Any]) -> dict[str, Any]:
    return _envelope("expense.updated", game_id, {"expense": expense})


def expense_deleted(game_id: uuid.UUID, expense_id: uuid.UUID) -> dict[str, Any]:
    return _envelope("expense.deleted", game_id, {"expense_id": str(expense_id)})


# ---------------------------------------------------------------------------
# Final stack events
# ---------------------------------------------------------------------------


def final_stack_updated(game_id: uuid.UUID, final_stack: dict[str, Any]) -> dict[str, Any]:
    return _envelope("final_stack.updated", game_id, {"final_stack": final_stack})
