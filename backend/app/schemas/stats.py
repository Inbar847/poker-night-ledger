"""
Schemas for Stage 8: history and personal statistics.
"""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class GameHistoryItem(BaseModel):
    """Summary of one closed game for the history list."""

    game_id: uuid.UUID
    title: str
    currency: str
    chip_cash_rate: Decimal
    closed_at: datetime
    role_in_game: str  # "dealer" | "player"
    # None if the user has no final stack (incomplete settlement)
    net_balance: Decimal | None
    total_buy_ins: Decimal


class RecentGameSummary(BaseModel):
    """Compact game summary used inside UserStats.recent_games."""

    game_id: uuid.UUID
    title: str
    closed_at: datetime
    net_balance: Decimal | None
    currency: str


class UserStats(BaseModel):
    """Personal statistics for a registered user."""

    total_games_played: int
    total_games_hosted: int
    # games_with_result: closed games where the user has a final stack
    games_with_result: int
    cumulative_net: Decimal
    # None when games_with_result == 0
    average_net: Decimal | None
    profitable_games: int
    # None when games_with_result == 0
    win_rate: float | None
    recent_games: list[RecentGameSummary]
