# Poker Night Ledger

A full-stack mobile app for managing real-world poker nights.
Track buy-ins, shared expenses, final chip counts, and settlement — in real time.

---

## Prerequisites

- Docker + Docker Compose
- Python 3.11+
- Node 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)

---

## Repository layout

```text
poker-night-ledger/
├─ mobile/          React Native + Expo + TypeScript
├─ backend/         FastAPI + SQLAlchemy + Alembic + PostgreSQL
├─ docs/            Product spec, architecture, plan
├─ docker-compose.yml
├─ CLAUDE.md
└─ README.md
```

---

## Quick start

### 1. Start PostgreSQL

```bash
docker compose up -d postgres
```

Postgres will be available at `localhost:5432`, database `poker_ledger`.

### 2. Set up the backend

```bash
cd backend
cp .env.example .env          # edit values if needed
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Health check: `http://localhost:8000/health`

Interactive docs: `http://localhost:8000/docs`

### 3. Set up the mobile app

```bash
cd mobile
cp .env.example .env          # set EXPO_PUBLIC_API_URL if needed
npm install
npx expo start
```

Then press `i` for iOS simulator, `a` for Android emulator, or scan the QR code with Expo Go.

---

## Running backend tests

```bash
cd backend
pytest
```

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | see `.env.example` | PostgreSQL connection string |
| `SECRET_KEY` | — | JWT signing secret (required for Stage 1+) |
| `DEBUG` | `false` | Enable debug mode |

### Mobile (`mobile/.env`)

| Variable | Default | Description |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://localhost:8000` | Backend base URL |

---

## Current stage

**Stage 0** — Foundation bootstrap complete.
See `docs/PLAN.md` for the full roadmap.
