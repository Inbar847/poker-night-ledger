import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database.session import get_db
from app.models.game import Game, GameStatus
from app.models.participant import Participant, RoleInGame
from app.models.user import User
from app.realtime import events as rt_events
from app.realtime.manager import manager
from app.models.notification import NotificationType
from app.schemas.game import GameCreate, GameResponse, InviteLinkResponse
from app.schemas.participant import (
    AddGuestRequest,
    InviteUserRequest,
    JoinByTokenRequest,
    ParticipantResponse,
)
from app.services import game_service, notification_service, participant_service
from app.services.user_service import get_user_by_id

router = APIRouter(prefix="/games", tags=["games"])


# ---------------------------------------------------------------------------
# Participant response builder — computes display_name for registered/guest
# ---------------------------------------------------------------------------


def _display_name(participant: Participant, user: User | None) -> str:
    if participant.guest_name:
        return participant.guest_name
    if user and user.full_name:
        return user.full_name
    if user:
        return user.email
    return f"Player ({str(participant.id)[:8]})"


def _build_participant_response(
    participant: Participant, user: User | None = None
) -> ParticipantResponse:
    return ParticipantResponse.model_validate({
        "id": participant.id,
        "game_id": participant.game_id,
        "user_id": participant.user_id,
        "guest_name": participant.guest_name,
        "display_name": _display_name(participant, user),
        "participant_type": participant.participant_type,
        "role_in_game": participant.role_in_game,
        "joined_at": participant.joined_at,
    })


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
async def join_by_token(
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
    result = participant_service.join_by_token(db, game, current_user)
    response_obj = _build_participant_response(result, current_user)
    await manager.broadcast(game.id, rt_events.participant_joined(game.id, response_obj.model_dump(mode="json")))
    return response_obj


@router.post("/{game_id}/invite-user", response_model=ParticipantResponse, status_code=status.HTTP_201_CREATED)
async def invite_user(
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
    result = participant_service.invite_user(db, game, invitee)
    response_obj = _build_participant_response(result, invitee)
    # Notify the invited user that they have been added to a game
    notification_service.create_notification(
        db,
        user_id=invitee.id,
        notification_type=NotificationType.game_invitation,
        data={"game_id": str(game_id), "invited_by_user_id": str(current_user.id)},
    )
    db.commit()
    await manager.broadcast(game_id, rt_events.participant_joined(game_id, response_obj.model_dump(mode="json")))
    return response_obj


@router.post("/{game_id}/guests", response_model=ParticipantResponse, status_code=status.HTTP_201_CREATED)
async def add_guest(
    game_id: uuid.UUID,
    body: AddGuestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ParticipantResponse:
    game = _get_game_or_404(db, game_id)
    participant = _get_participant_or_403(db, game_id, current_user.id)
    _require_dealer(participant)
    result = participant_service.add_guest(db, game, body.guest_name)
    response_obj = _build_participant_response(result)
    await manager.broadcast(game_id, rt_events.participant_joined(game_id, response_obj.model_dump(mode="json")))
    return response_obj


@router.post("/{game_id}/start", response_model=GameResponse)
async def start_game(
    game_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GameResponse:
    game = _get_game_or_404(db, game_id)
    participant = _get_participant_or_403(db, game_id, current_user.id)
    _require_dealer(participant)
    try:
        result = game_service.start_game(db, game)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    # Notify all registered participants that the game has started
    participants = participant_service.get_participants(db, game_id)
    for p in participants:
        if p.user_id is not None:
            notification_service.create_notification(
                db,
                user_id=p.user_id,
                notification_type=NotificationType.game_started,
                data={"game_id": str(game_id)},
            )
    db.commit()
    await manager.broadcast(game_id, rt_events.game_started(game_id))
    return result


@router.post("/{game_id}/close", response_model=GameResponse)
async def close_game(
    game_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GameResponse:
    game = _get_game_or_404(db, game_id)
    participant = _get_participant_or_403(db, game_id, current_user.id)
    _require_dealer(participant)
    try:
        result = game_service.close_game(db, game)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    # Notify all registered participants that the game has closed
    participants = participant_service.get_participants(db, game_id)
    for p in participants:
        if p.user_id is not None:
            notification_service.create_notification(
                db,
                user_id=p.user_id,
                notification_type=NotificationType.game_closed,
                data={"game_id": str(game_id)},
            )
    db.commit()
    # Broadcast both close and settlement-ready signals
    await manager.broadcast(game_id, rt_events.game_closed(game_id))
    await manager.broadcast(game_id, rt_events.settlement_updated(game_id))
    return result


@router.get("/{game_id}/participants", response_model=list[ParticipantResponse])
def get_participants(
    game_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ParticipantResponse]:
    _get_game_or_404(db, game_id)
    _get_participant_or_403(db, game_id, current_user.id)
    participants = participant_service.get_participants(db, game_id)
    # Load users for registered participants to compute display_name
    user_ids = [p.user_id for p in participants if p.user_id is not None]
    users_by_id: dict[uuid.UUID, User] = {}
    if user_ids:
        for u in db.query(User).filter(User.id.in_(user_ids)).all():
            users_by_id[u.id] = u
    return [
        _build_participant_response(p, users_by_id.get(p.user_id) if p.user_id else None)
        for p in participants
    ]
