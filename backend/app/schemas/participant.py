import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.participant import ParticipantType, RoleInGame


class ParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    game_id: uuid.UUID
    user_id: uuid.UUID | None
    guest_name: str | None
    participant_type: ParticipantType
    role_in_game: RoleInGame
    joined_at: datetime


class InviteUserRequest(BaseModel):
    user_id: uuid.UUID


class AddGuestRequest(BaseModel):
    guest_name: str = Field(min_length=1, max_length=255)


class JoinByTokenRequest(BaseModel):
    token: str
