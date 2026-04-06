import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database.session import get_db
from app.models.game import Game, GameStatus
from app.models.participant import Participant, RoleInGame
from app.models.user import User
from app.schemas.game import GameCreate, GameResponse, InviteLinkResponse
from app.schemas.participant import (
    AddGuestRequest,
    InviteUserRequest,
    JoinByTokenRequest,
    ParticipantResponse,
)
from app.services import game_service, participant_service
from app.services.user_service import get_user_by_id

router = APIRouter(prefix="/games", tags=["games"])


# ---------------------------------------------------------------------------
# Internal helpers — keep HTTP concerns out of the service layer
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


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("", response_model=GameResponse, status_code=status.HTTP_201_CREATED)
def create_game(
    data: GameCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GameResponse:
    return game_service.create_game(db, data, current_user.id)


@router.get("", response_model=list[GameResponse])
def list_games(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[GameResponse]:
    return game_service.list_games_for_user(db, current_user.id)


@router.get("/{game_id}", response_model=GameResponse)
def get_game(
    game_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GameResponse:
    game = _get_game_or_404(db, game_id)
    _get_participant_or_403(db, game_id, current_user.id)
    return game


@router.post("/{game_id}/invite-link", response_model=InviteLinkResponse)
def generate_invite_link(
    game_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InviteLinkResponse:
    game = _get_game_or_404(db, game_id)
    participant = _get_participant_or_403(db, game_id, current_user.id)
    _require_dealer(participant)
    game = game_service.rotate_invite_token(db, game)
    return InviteLinkResponse(game_id=game.id, invite_token=game.invite_token)


@router.post("/join-by-token", response_model=ParticipantResponse, status_code=status.HTTP_201_CREATED)
def join_by_token(
    body: JoinByTokenRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ParticipantResponse:
    game = game_service.get_game_by_invite_token(db, body.token)
    if game is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite token not found",
        )
    if game.status == GameStatus.closed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game is already closed",
        )
    existing = participant_service.get_participant_for_user(db, game.id, current_user.id)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already a participant in this game",
        )
    return participant_service.join_by_token(db, game, current_user)


@router.post("/{game_id}/invite-user", response_model=ParticipantResponse, status_code=status.HTTP_201_CREATED)
def invite_user(
    game_id: uuid.UUID,
    body: InviteUserRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ParticipantResponse:
    game = _get_game_or_404(db, game_id)
    participant = _get_participant_or_403(db, game_id, current_user.id)
    _require_dealer(participant)

    invitee = get_user_by_id(db, body.user_id)
    if invitee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    existing = participant_service.get_participant_for_user(db, game_id, body.user_id)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a participant in this game",
        )
    return participant_service.invite_user(db, game, invitee)


@router.post("/{game_id}/guests", response_model=ParticipantResponse, status_code=status.HTTP_201_CREATED)
def add_guest(
    game_id: uuid.UUID,
    body: AddGuestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ParticipantResponse:
    game = _get_game_or_404(db, game_id)
    participant = _get_participant_or_403(db, game_id, current_user.id)
    _require_dealer(participant)
    return participant_service.add_guest(db, game, body.guest_name)


@router.post("/{game_id}/start", response_model=GameResponse)
def start_game(
    game_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GameResponse:
    game = _get_game_or_404(db, game_id)
    participant = _get_participant_or_403(db, game_id, current_user.id)
    _require_dealer(participant)
    try:
        return game_service.start_game(db, game)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{game_id}/close", response_model=GameResponse)
def close_game(
    game_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GameResponse:
    game = _get_game_or_404(db, game_id)
    participant = _get_participant_or_403(db, game_id, current_user.id)
    _require_dealer(participant)
    try:
        return game_service.close_game(db, game)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{game_id}/participants", response_model=list[ParticipantResponse])
def get_participants(
    game_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ParticipantResponse]:
    _get_game_or_404(db, game_id)
    _get_participant_or_403(db, game_id, current_user.id)
    return participant_service.get_participants(db, game_id)
