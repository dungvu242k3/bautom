# Bầu Cua Arena

React + Supabase realtime game for Bầu Cua Tôm Cá.

## Features

- Username/password login and register, no real Gmail required.
- Lobby with public/private rooms and room code join.
- Room setup: min bet, max bet, max players, betting duration.
- Realtime players, room state, bets, wallet balance, and chat.
- Server-authoritative wallet, bet, lock, reveal, and payout logic through Supabase RPC.
- Fixed 3 second opening phase.
- RLS keeps wallets and transaction history private.
- Unit tests for game payout and validation rules.

## Local Setup

1. Copy `.env.example` to `.env`.
2. Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Run `supabase/schema.sql` in the Supabase SQL Editor.
4. In Supabase Auth, use Email provider and disable email confirmation for the internal `@baucua.local` aliases.
5. Start locally:

```bash
npm install
npm run dev
```

## Deploy on Vercel

Set these environment variables on Vercel:

```bash
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Build command: `npm run build`

Output directory: `dist`

## Quality

```bash
npm run lint
npm run test
npm run build
```

The backend trust boundary is in `supabase/schema.sql`: clients cannot update wallets, create payouts, or set dice directly. Those flows are handled by RPC functions with row locks and RLS.
