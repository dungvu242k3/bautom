// Types định nghĩa cho hệ thống Game Bầu Cua

export type GamePhase = 
  | 'waiting'      // Đang chờ đủ người / chờ bắt đầu
  | 'betting'      // Cho phép đặt cược (15 giây)
  | 'lock'         // Đã khóa cược (2 giây)
  | 'shake'        // Đang lắc bát (3 giây)
  | 'reveal'       // Đang mở bát và hiển thị xúc xắc
  | 'settlement'   // Đang tính xu thắng/thua và hoàn trả ví
  | 'finished';    // Hoàn thành ván chơi

export type AnimalType = 'bau' | 'cua' | 'tom' | 'ca' | 'ga' | 'nai';

export interface User {
  id: string;
  email: string;
  username: string;
  status: 'active' | 'suspended';
  role: 'user' | 'admin';
}

export interface Profile {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_win: number;
  total_loss: number;
  win_streak: number;
  max_win_streak: number;
}

export interface Wallet {
  user_id: string;
  balance: number;
  locked_balance: number;
}

export interface Room {
  id: string;
  name: string;
  code: string | null;
  is_private: boolean;
  max_players: number;
  min_bet: number;
  max_bet: number;
  bet_duration: number;
  status: 'waiting' | 'playing';
  current_round_id: string | null;
  created_by: string;
  created_at: string;
}

export interface RoomPlayer {
  id: string;
  room_id: string;
  user_id: string;
  is_host: boolean;
  is_online: boolean;
  joined_at: string;
  // Mở rộng từ join với profiles
  display_name?: string;
  avatar_url?: string | null;
  balance?: number;
}

export interface Round {
  id: string;
  room_id: string;
  phase: GamePhase;
  status: 'active' | 'finished';
  phase_started_at: string;
  phase_ends_at: string;
  dice_1: AnimalType | null;
  dice_2: AnimalType | null;
  dice_3: AnimalType | null;
  created_at: string;
}

export interface Bet {
  id: string;
  round_id: string;
  room_id: string;
  user_id: string;
  animal: AnimalType;
  amount: number;
  created_at: string;
}

export interface CoinTransaction {
  id: string;
  user_id: string;
  round_id: string | null;
  type: 'initial_bonus' | 'place_bet' | 'refund_bet' | 'win_reward';
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  message: string;
  created_at: string;
  // Mở rộng từ join
  username?: string;
}
