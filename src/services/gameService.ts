import { supabase } from './supabaseClient';
import { AnimalType, Round } from '@/types/game.types';

export const gameService = {
  // 1. Đặt cược thông qua RPC an toàn trên database
  async placeBet(roundId: string, animal: AnimalType, amount: number): Promise<any> {
    const { data, error } = await supabase.rpc('place_bet', {
      p_round_id: roundId,
      p_animal: animal,
      p_amount: amount
    });

    if (error) throw error;
    return data;
  },

  // 2. Chuyển đổi trạng thái phase của round (Host điều khiển hoặc server)
  async transitionPhase(
    roundId: string,
    newPhase: 'waiting' | 'betting' | 'lock' | 'shake' | 'reveal' | 'finished',
    durationSeconds: number
  ): Promise<void> {
    const phaseEndsAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
    
    const { error } = await supabase
      .from('rounds')
      .update({
        phase: newPhase,
        phase_started_at: new Date().toISOString(),
        phase_ends_at: phaseEndsAt
      })
      .eq('id', roundId);

    if (error) throw error;
  },

  // 3. Host bắt đầu game hoặc bắt đầu vòng cược mới bằng RPC an toàn, hiệu năng cao
  async startNewRound(roomId: string, durationSeconds: number = 15): Promise<Round> {
    console.log('[gameService.startNewRound] Bắt đầu ván mới qua RPC:', { roomId, durationSeconds });

    const { data, error } = await supabase.rpc('start_new_round', {
      p_room_id: roomId,
      p_bet_duration: durationSeconds
    });

    if (error) {
      console.error('[gameService.startNewRound] LỖI bắt đầu ván mới qua RPC:', error);
      throw error;
    }

    console.log('[gameService.startNewRound] Bắt đầu ván mới qua RPC thành công:', data);
    return data as Round;
  },

  // 4. Gọi RPC settle_round để sinh kết quả ngẫu nhiên và tính xu
  async settleRound(roundId: string): Promise<any> {
    const { data, error } = await supabase.rpc('settle_round', {
      p_round_id: roundId
    });

    if (error) throw error;
    return data;
  },

  // 5. Gửi tin nhắn chat vào phòng cược
  async sendChatMessage(roomId: string, message: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        user_id: user.id,
        message
      });

    if (error) throw error;
  },

  // 6. Lấy lịch sử 5 ván cược gần nhất trong phòng
  async getRecentRounds(roomId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('rounds')
      .select('id, dice_1, dice_2, dice_3, created_at')
      .eq('room_id', roomId)
      .eq('status', 'finished')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;
    return data;
  }
};
