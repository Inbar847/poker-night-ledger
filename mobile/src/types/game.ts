/**
 * Domain types for games, ledger, and settlement.
 * These mirror the backend Pydantic response schemas.
 * Decimal fields come as strings from the FastAPI JSON encoder.
 */

export type GameStatus = "lobby" | "active" | "closed";
export type ParticipantType = "registered" | "guest";
export type RoleInGame = "dealer" | "player";
export type BuyInType = "initial" | "rebuy" | "addon";

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

export interface Game {
  id: string;
  title: string;
  created_by_user_id: string;
  dealer_user_id: string;
  scheduled_at: string | null;
  chip_cash_rate: string;
  currency: string;
  status: GameStatus;
  invite_token: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface CreateGameRequest {
  title: string;
  chip_cash_rate: string;
  currency?: string;
  scheduled_at?: string | null;
}

// ---------------------------------------------------------------------------
// Participant
// ---------------------------------------------------------------------------

export interface Participant {
  id: string;
  game_id: string;
  user_id: string | null;
  guest_name: string | null;
  display_name: string;
  participant_type: ParticipantType;
  role_in_game: RoleInGame;
  joined_at: string;
}

// ---------------------------------------------------------------------------
// Buy-in
// ---------------------------------------------------------------------------

export interface BuyIn {
  id: string;
  game_id: string;
  participant_id: string;
  cash_amount: string;
  chips_amount: string;
  buy_in_type: BuyInType;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBuyInRequest {
  participant_id: string;
  cash_amount: string;
  chips_amount: string;
  buy_in_type: BuyInType;
}

// ---------------------------------------------------------------------------
// Expense
// ---------------------------------------------------------------------------

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  participant_id: string;
  share_amount: string;
}

export interface Expense {
  id: string;
  game_id: string;
  title: string;
  total_amount: string;
  paid_by_participant_id: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  splits: ExpenseSplit[];
}

export interface CreateExpenseRequest {
  title: string;
  total_amount: string;
  paid_by_participant_id: string;
  splits: { participant_id: string; share_amount: string }[];
}

// ---------------------------------------------------------------------------
// Final stack
// ---------------------------------------------------------------------------

export interface FinalStack {
  id: string;
  game_id: string;
  participant_id: string;
  chips_amount: string;
  created_at: string;
  updated_at: string;
}

export interface UpsertFinalStackRequest {
  chips_amount: string;
}

// ---------------------------------------------------------------------------
// Settlement
// ---------------------------------------------------------------------------

export interface ParticipantBalance {
  participant_id: string;
  display_name: string;
  participant_type: string;
  total_buy_ins: string;
  final_chips: string | null;
  final_chip_cash_value: string | null;
  poker_balance: string | null;
  amount_paid_for_group: string;
  owed_expense_share: string;
  expense_balance: string;
  net_balance: string | null;
}

export interface Transfer {
  from_participant_id: string;
  from_display_name: string;
  to_participant_id: string;
  to_display_name: string;
  amount: string;
}

export interface Settlement {
  game_id: string;
  game_status: string;
  chip_cash_rate: string;
  currency: string;
  is_complete: boolean;
  balances: ParticipantBalance[];
  transfers: Transfer[];
}
