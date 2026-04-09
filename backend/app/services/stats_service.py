"""
Stats service — Stage 8.

Computes personal game history and statistics for a registered user.
Guest-only identities cannot authenticate and will never reach these endpoints.

All stats are restricted to closed games where the calling user was a
registered participant (Participant.user_id == user.id).
"""

import uuid
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.models.game import Game, GameStatus
from app.models.ledger import BuyIn, Expense, ExpenseSplit, FinalStack
from app.models.participant import Participant
from app.schemas.settlement import SettlementResponse
from app.schemas.stats import GameHistoryItem, RecentGameSummary, UserStats
from app.services.settlement_service import get_settlement

_TWO = Decimal("0.01")
_RECENT_LIMIT = 5


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _participant_net_balance(
    db: Session,
    participant: Participant,
    game: Game,
) -> Decimal | None:
    """
    Compute the net_balance for a single participant in a game.
    Returns None if the participant has no final stack recorded.

    Formula mirrors settlement_service:
        total_buy_ins         = sum(buy_in.cash_amount)
        final_chip_cash_value = quantize(chips * chip_cash_rate, 2dp, ROUND_HALF_UP)
        poker_balance         = final_chip_cash_value - total_buy_ins
        amount_paid           = sum(expense.total_amount where paid_by == participant)
        owed_share            = sum(split.share_amount where split.participant == participant)
        expense_balance       = amount_paid - owed_share
        net_balance           = poker_balance + expense_balance
    """
    final_stack = (
        db.query(FinalStack)
        .filter(
            FinalStack.game_id == game.id,
            FinalStack.participant_id == participant.id,
        )
        .first()
    )
    if final_stack is None:
        return None

    buy_ins = (
        db.query(BuyIn)
        .filter(BuyIn.game_id == game.id, BuyIn.participant_id == participant.id)
        .all()
    )
    total_buy_ins = sum((b.cash_amount for b in buy_ins), Decimal("0"))

    final_chip_cash_value = (
        final_stack.chips_amount * game.chip_cash_rate
    ).quantize(_TWO, rounding=ROUND_HALF_UP)
    poker_balance = final_chip_cash_value - total_buy_ins

    # Expenses paid by this participant for the whole group
    expenses_paid = (
        db.query(Expense)
        .filter(
            Expense.game_id == game.id,
            Expense.paid_by_participant_id == participant.id,
        )
        .all()
    )
    amount_paid = sum((e.total_amount for e in expenses_paid), Decimal("0"))

    # This participant's share of all expenses in the game
    expense_ids = [
        e.id
        for e in db.query(Expense.id).filter(Expense.game_id == game.id)
    ]
    owed_share = Decimal("0")
    if expense_ids:
        splits = (
            db.query(ExpenseSplit)
            .filter(
                ExpenseSplit.participant_id == participant.id,
                ExpenseSplit.expense_id.in_(expense_ids),
            )
            .all()
        )
        owed_share = sum((s.share_amount for s in splits), Decimal("0"))

    expense_balance = amount_paid - owed_share
    return poker_balance + expense_balance


def _total_buy_ins_for_participant(
    db: Session, participant: Participant, game: Game
) -> Decimal:
    buy_ins = (
        db.query(BuyIn)
        .filter(BuyIn.game_id == game.id, BuyIn.participant_id == participant.id)
        .all()
    )
    return sum((b.cash_amount for b in buy_ins), Decimal("0"))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_history(db: Session, user_id: uuid.UUID) -> list[GameHistoryItem]:
    """
    Return all closed games where the user was a registered participant,
    ordered by closed_at descending (most recent first).
    """
    participants = (
        db.query(Participant).filter(Participant.user_id == user_id).all()
    )
    if not participants:
        return []

    game_ids = [p.game_id for p in participants]
    games = (
        db.query(Game)
        .filter(Game.id.in_(game_ids), Game.status == GameStatus.closed)
        .order_by(Game.closed_at.desc())
        .all()
    )

    participant_by_game: dict[uuid.UUID, Participant] = {
        p.game_id: p for p in participants
    }

    result: list[GameHistoryItem] = []
    for game in games:
        p = participant_by_game[game.id]
        net = _participant_net_balance(db, p, game)
        total_buy_ins = _total_buy_ins_for_participant(db, p, game)
        result.append(
            GameHistoryItem(
                game_id=game.id,
                title=game.title,
                currency=game.currency,
                chip_cash_rate=game.chip_cash_rate,
                closed_at=game.closed_at,  # type: ignore[arg-type]
                role_in_game=p.role_in_game.value,
                net_balance=net,
                total_buy_ins=total_buy_ins,
            )
        )
    return result


def get_history_game(
    db: Session, game_id: uuid.UUID, user_id: uuid.UUID
) -> SettlementResponse | None:
    """
    Return the full settlement view for a single closed game.
    Returns None if the game does not exist, is not closed, or the user
    was not a registered participant.
    """
    game = (
        db.query(Game)
        .filter(Game.id == game_id, Game.status == GameStatus.closed)
        .first()
    )
    if game is None:
        return None

    participant = (
        db.query(Participant)
        .filter(
            Participant.game_id == game_id,
            Participant.user_id == user_id,
        )
        .first()
    )
    if participant is None:
        return None

    return get_settlement(db, game)


def get_stats(db: Session, user_id: uuid.UUID) -> UserStats:
    """
    Compute personal stats for a registered user across all closed games
    where they were a registered participant.
    """
    participants = (
        db.query(Participant).filter(Participant.user_id == user_id).all()
    )
    if not participants:
        return UserStats(
            total_games_played=0,
            total_games_hosted=0,
            games_with_result=0,
            cumulative_net=Decimal("0"),
            average_net=None,
            profitable_games=0,
            win_rate=None,
            recent_games=[],
        )

    game_ids = [p.game_id for p in participants]
    games = (
        db.query(Game)
        .filter(Game.id.in_(game_ids), Game.status == GameStatus.closed)
        .order_by(Game.closed_at.desc())
        .all()
    )

    participant_by_game: dict[uuid.UUID, Participant] = {
        p.game_id: p for p in participants
    }

    total_games_played = len(games)
    total_games_hosted = sum(
        1 for g in games if g.dealer_user_id == user_id
    )

    # Compute net balance once per game, reuse for both stats and recent_games
    net_by_game: dict[uuid.UUID, Decimal | None] = {}
    for game in games:
        p = participant_by_game[game.id]
        net_by_game[game.id] = _participant_net_balance(db, p, game)

    net_balances = [n for n in net_by_game.values() if n is not None]
    games_with_result = len(net_balances)
    profitable_games = sum(1 for n in net_balances if n > Decimal("0"))

    cumulative_net = sum(net_balances, Decimal("0")).quantize(
        _TWO, rounding=ROUND_HALF_UP
    )
    average_net = (
        (cumulative_net / games_with_result).quantize(_TWO, rounding=ROUND_HALF_UP)
        if games_with_result > 0
        else None
    )
    win_rate = (
        round(profitable_games / games_with_result, 4)
        if games_with_result > 0
        else None
    )

    recent_games = [
        RecentGameSummary(
            game_id=game.id,
            title=game.title,
            closed_at=game.closed_at,  # type: ignore[arg-type]
            net_balance=net_by_game[game.id],
            currency=game.currency,
        )
        for game in games[:_RECENT_LIMIT]
    ]

    return UserStats(
        total_games_played=total_games_played,
        total_games_hosted=total_games_hosted,
        games_with_result=games_with_result,
        cumulative_net=cumulative_net,
        average_net=average_net,
        profitable_games=profitable_games,
        win_rate=win_rate,
        recent_games=recent_games,
    )
