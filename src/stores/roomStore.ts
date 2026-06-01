import { create } from 'zustand';
import { Room, RoomPlayer } from '@/types/game.types';

interface RoomState {
  activeRoom: Room | null;
  players: RoomPlayer[];
  loading: boolean;
  error: string | null;

  setActiveRoom: (room: Room | null) => void;
  setPlayers: (players: RoomPlayer[]) => void;
  addPlayer: (player: RoomPlayer) => void;
  removePlayer: (userId: string) => void;
  updatePlayerStatus: (userId: string, isOnline: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  activeRoom: null,
  players: [],
  loading: false,
  error: null,

  setActiveRoom: (room) => set({ activeRoom: room }),
  setPlayers: (players) => set({ players }),
  
  addPlayer: (player) => set((state) => {
    // Chống trùng lặp người chơi
    const exists = state.players.some((p) => p.user_id === player.user_id);
    if (exists) return {};
    return { players: [...state.players, player] };
  }),

  removePlayer: (userId) => set((state) => ({
    players: state.players.filter((p) => p.user_id !== userId)
  })),

  updatePlayerStatus: (userId, isOnline) => set((state) => ({
    players: state.players.map((p) => 
      p.user_id === userId ? { ...p, is_online: isOnline } : p
    )
  })),

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error })
}));
