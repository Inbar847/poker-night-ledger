import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.game import GameStatus


class GameCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    scheduled_at: datetime | None = None
    chip_cash_rate: Decimal = Field(gt=0)
    currency: str = Field(default="USD", max_length=10)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("title must not be blank or whitespace-only.")
        return stripped


class GameResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    created_by_user_id: uuid.UUID
    dealer_user_id: uuid.UUID
    scheduled_at: datetime | None
    chip_cash_rate: Decimal
    currency: str
    status: GameStatus
    invite_token: str | None
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None


class InviteLinkResponse(BaseModel):
    game_id: uuid.UUID
    invite_token: str
