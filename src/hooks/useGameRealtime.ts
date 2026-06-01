import { useEffect } from 'react';
import { supabase } from '@/services/supabaseClient';
import { useGameStore } from '@/stores/gameStore';
import { useRoomStore } from '@/stores/roomStore';
import { useAuthStore } from '@/stores/authStore';
import { Bet, ChatMessage, Round, RoomPlayer, Wallet } from '@/types/game.types';

export const useGameRealtime = (roomId: string) => {
  const { setRoundState, addBet, addChatMessage } = useGameStore();
  const { addPlayer, removePlayer, updatePlayerStatus } = useRoomStore();
  const { user, setWallet } = useAuthStore();

  useEffect(() => {
    if (!roomId || !user) return;

    // 1. Subscribe vào Channel của phòng chơi
    const channelName = `room_channel:${roomId}`;
    const channel = supabase.channel(channelName);

    channel
      // A. Lắng nghe thay đổi trạng thái ván game (rounds)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rounds',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          if (payload.new) {
            setRoundState(payload.new as Round);
          }
        }
      )
      // B. Lắng nghe người chơi khác tham gia/rời phòng (room_players)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_players',
          filter: `room_id=eq.${roomId}`
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newPlayer = payload.new as RoomPlayer;
            // Fetch thêm display_name và avatar của profile mới
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, avatar_url')
              .eq('user_id', newPlayer.user_id)
              .single();

            const { data: wallet } = await supabase
              .from('wallets')
              .select('balance')
              .eq('user_id', newPlayer.user_id)
              .single();

            addPlayer({
              ...newPlayer,
              display_name: profile?.display_name || 'Người chơi',
              avatar_url: profile?.avatar_url || null,
              balance: wallet?.balance || 0
            });
          } else if (payload.eventType === 'DELETE') {
            const oldPlayer = payload.old as { id: string };
            // Tìm và xóa người chơi khỏi state
            const target = useRoomStore.getState().players.find(p => p.id === oldPlayer.id);
            if (target) {
              removePlayer(target.user_id);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedPlayer = payload.new as RoomPlayer;
            updatePlayerStatus(updatedPlayer.user_id, updatedPlayer.is_online);
          }
        }
      )
      // C. Lắng nghe đặt cược realtime (bets)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bets',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          if (payload.new) {
            addBet(payload.new as Bet);
          }
        }
      )
      // D. Lắng nghe tin nhắn chat realtime (chat_messages)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`
        },
        async (payload) => {
          if (payload.new) {
            const newMsg = payload.new as ChatMessage;
            // Fetch username
            const { data: userData } = await supabase
              .from('users')
              .select('username')
              .eq('id', newMsg.user_id)
              .single();

            addChatMessage({
              ...newMsg,
              username: userData?.username || 'Vô danh'
            });
          }
        }
      )
      // E. Lắng nghe cập nhật ví xu cá nhân (wallets)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.new) {
            setWallet(payload.new as Wallet);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Đã kết nối thành công phòng cược realtime: ${roomId}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user]);
};
