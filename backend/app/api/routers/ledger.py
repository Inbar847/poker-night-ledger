"""
Ledger router — buy-ins, expenses, and final stacks for a live game.

All mutation endpoints are dealer-only.
All read endpoints require game participation.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database.session import get_db
from app.models.game import Game
from app.models.participant import Participant, RoleInGame
from app.models.user import User
from app.schemas.ledger import (
    BuyInCreate,
    BuyInResponse,
    BuyInUpdate,
    ExpenseCreate,
    ExpenseResponse,
    ExpenseUpdate,
    FinalStackResponse,
    FinalStackUpsert,
)
from app.services import game_service, ledger_service, participant_service

router = APIRouter(prefix="/games", tags=["ledger"])


# ---------------------------------------------------------------------------
# Shared helpers (mirrors pattern from games.py to keep routers thin)
# ---------------------------------------------------------------------------


def _get_game_or_404(db: Session, game_id: uuid.UUID) -> Game:
    game = game_service.get_game_by_id(db, game_id)
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    return game


def _get_participant_or_403(db: Session, game_id: uuid.UUID, user_id: uuid.UUID) -> Participant:
    p = participant_service.get_participant_for_user(db, game_id, user_id)
    if p is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a participant in this game",
        )
    return p


def _require_dealer(participant: Participant) -> None:
    if participant.role_in_game != RoleInGame.dealer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dealer access required",
        )


def _service_error_to_http(exc: ValueError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ---------------------------------------------------------------------------
# Buy-ins
# ---------------------------------------------------------------------------


@router.post(
    "/{game_id}/buy-ins",
    response_model=BuyInResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_buy_in(
    game_id: uuid.UUID,
    data: BuyInCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BuyInResponse:
    game = _get_game_or_404(db, game_id)
    participant = _get_participant_or_403(db, game_id, current_user.id)
    _require_dealer(participant)
    try:
        return ledger_service.create_buy_in(db, game, data, current_user.id)
    except ValueError as exc:
        raise _service_error_to_http(exc) from exc


@router.get("/{game_id}/buy-ins", response_model=list[BuyInResponse])
def list_buy_ins(
    game_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[BuyInResponse]:
    _get_game_or_404(db, game_id)
    _get_participant_or_403(db, game_id, current_user.id)
    return ledger_service.list_buy_ins(db, game_id)


@router.patch("/{game_id}/buy-ins/{buy_in_id}", response_model=BuyInResponse)
def update_buy_in(
    game_id: uuid.UUID,
    buy_in_id: uuid.UUID,
    data: BuyInUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BuyInResponse:
    game = _get_game_or_404(db, game_id)
    participant = _get_participant_or_403(db, game_id, current_user.id)
    _require_dealer(participant)

    buy_in = ledger_service.get_buy_in(db, game_id, buy_in_id)
    if buy_in is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Buy-in not found")

    try:
        return ledger_service.update_buy_in(db, game, buy_in, data)
    except ValueError as exc:
        raise _service_error_to_http(exc) from exc


@router.delete("/{game_id}/buy-ins/{buy_in_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_buy_in(
    game_id: uuid.UUID,
    buy_in_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    game = _get_game_or_404(db, game_id)
    participant = _get_participant_or_403(db, game_id, current_user.id)
    _require_dealer(participant)

    buy_in = ledger_service.get_buy_in(db, game_id, buy_in_id)
    if buy_in is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Buy-in not found")

    try:
        ledger_service.delete_buy_in(db, game, buy_in)
    except ValueError as exc:
        raise _service_error_to_http(exc) from exc


# ---------------------------------------------------------------------------
# Expenses
# ---------------------------------------------------------------------------


@router.post(
    "/{game_id}/expenses",
    response_model=ExpenseResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_expense(
    game_id: uuid.UUID,
    data: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExpenseResponse:
    game = _get_game_or_404(db, game_id)
    participant = _get_participant_or_403(db, game_id, current_user.id)
    _require_dealer(participant)
    try:
        return ledger_service.create_expense(db, game, data, current_user.id)
    except ValueError as exc:
        raise _service_error_to_http(exc) from exc


@router.get("/{game_id}/expenses", response_model=list[ExpenseResponse])
def list_expenses(
    game_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ExpenseResponse]:
    _get_game_or_404(db, game_id)
    _get_participant_or_403(db, game_id, current_user.id)
    return ledger_service.list_expenses(db, game_id)


@router.patch("/{game_id}/expenses/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    game_id: uuid.UUID,
    expense_id: uuid.UUID,
    data: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExpenseResponse:
    game = _get_game_or_404(db, game_id)
    participant = _get_participant_or_403(db, game_id, current_user.id)
    _require_dealer(participant)

    expense = ledger_service.get_expense(db, game_id, expense_id)
    if expense is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")

    try:
        return ledger_service.update_expense(db, game, expense, data)
    except ValueError as exc:
        raise _service_error_to_http(exc) from exc


@router.delete("/{game_id}/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    game_id: uuid.UUID,
    expense_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    game = _get_game_or_404(db, game_id)
    participant = _get_participant_or_403(db, game_id, current_user.id)
    _require_dealer(participant)

    expense = ledger_service.get_expense(db, game_id, expense_id)
    if expense is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")

    try:
        ledger_service.delete_expense(db, game, expense)
    except ValueError as exc:
        raise _service_error_to_http(exc) from exc


# ---------------------------------------------------------------------------
# Final stacks
# ---------------------------------------------------------------------------


@router.put(
    "/{game_id}/final-stacks/{participant_id}",
    response_model=FinalStackResponse,
)
def upsert_final_stack(
    game_id: uuid.UUID,
    participant_id: uuid.UUID,
    data: FinalStackUpsert,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FinalStackResponse:
    game = _get_game_or_404(db, game_id)
    requester = _get_participant_or_403(db, game_id, current_user.id)
    _require_dealer(requester)
    try:
        return ledger_service.upsert_final_stack(db, game, participant_id, data)
    except ValueError as exc:
        raise _service_error_to_http(exc) from exc


@router.get("/{game_id}/final-stacks", response_model=list[FinalStackResponse])
def list_final_stacks(
    game_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[FinalStackResponse]:
    _get_game_or_404(db, game_id)
    _get_participant_or_403(db, game_id, current_user.id)
    return ledger_service.list_final_stacks(db, game_id)
