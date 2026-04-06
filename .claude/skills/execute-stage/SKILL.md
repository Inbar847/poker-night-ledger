---
name: execute-stage
description: Execute exactly one approved stage from docs/PLAN.md for Poker Night Ledger. Read CLAUDE.md and all project docs first, stay within the requested stage boundary, and stop when the stage is complete.
---

# execute-stage

Use this skill when the user asks to implement a specific stage from `docs/PLAN.md`.

## Required behavior

1. Read these files first:
   - `CLAUDE.md`
   - `docs/PLAN.md`
   - `docs/PRODUCT_SPEC.md`
   - `docs/ARCHITECTURE.md`

2. Identify the exact stage requested by the user.

3. Before coding, provide:
   - a concise restatement of the stage goal
   - likely files to be created/changed
   - any small assumptions

4. Implement **only** the requested stage.
   - Do not continue into future stages.
   - Do not perform broad refactors unless strictly necessary.
   - Keep business logic out of UI.
   - Preserve approved product rules.

5. Add or update tests where relevant.

6. At the end, provide:
   - what was implemented
   - changed files
   - commands to run
   - manual test steps
   - tests run
   - assumptions/deferred items

7. Stop and wait for the next instruction.

## Product-specific constraints

- Support registered users and guests.
- Only the dealer can update buy-ins.
- Realtime is required.
- Settlement payment-status tracking is out of scope for MVP.
- Invite flow must support links/tokens and inviting existing users.
- Statistics are personal only.
- Dealer is the MVP source of truth for official ledger edits.
