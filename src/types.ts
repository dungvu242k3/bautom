import type { User } from '@supabase/supabase-js';

export type Animal = 'bau' | 'cua' | 'tom' | 'ca' | 'ga' | 'nai';
export type RoundPhase = 'waiting' | 'betting' | 'opening' | 'revealed' | 'finished';

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  total_win: number;
  total_loss: number;
  win_streak: number;
  max_win_streak: number;
};

export type Wallet = {
  user_id: string;
  balance: number;
  updated_at: string;
};

export type Room = {
  id: string;
  code: string;
  name: string;
  is_private: boolean;
  max_players: number;
  min_bet: number;
  max_bet: number;
  bet_duration: number;
  open_duration: number;
  status: 'waiting' | 'playing';
  current_round_id: string | null;
  created_by: string;
  created_at: string;
};

export type RoomPlayer = {
  room_id: string;
  user_id: string;
  is_host: boolean;
  joined_at: string;
  profiles?: Pick<Profile, 'id' | 'display_name' | 'username' | 'win_streak'> | null;
};

export type Round = {
  id: string;
  room_id: string;
  phase: RoundPhase;
  phase_started_at: string;
  phase_ends_at: string;
  dice: Animal[];
  created_at: string;
};

export type Bet = {
  id: string;
  round_id: string;
  room_id: string;
  user_id: string;
  animal: Animal;
  amount: number;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  room_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: Pick<Profile, 'display_name' | 'username'> | null;
};

export type AuthState = {
  user: User | null;
  profile: Profile | null;
  wallet: Wallet | null;
};

export type RoomForm = {
  name: string;
  isPrivate: boolean;
  maxPlayers: number;
  minBet: number;
  maxBet: number;
  betDuration: number;
};
