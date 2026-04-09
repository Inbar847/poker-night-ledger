from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import auth, friends, games, history, ledger, notifications, settlement, social, users, ws
from app.core.config import settings

app = FastAPI(
    title="Poker Night Ledger",
    version="0.1.0",
    debug=settings.debug,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tightened to explicit origins in Stage 1 when auth is added
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(friends.router)
app.include_router(games.router)
app.include_router(ledger.router)
app.include_router(settlement.router)
app.include_router(history.router)
app.include_router(notifications.router)
app.include_router(social.router)
app.include_router(ws.router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
