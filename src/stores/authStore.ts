import { create } from 'zustand';
import { supabase } from '@/services/supabaseClient';
import { User, Profile, Wallet } from '@/types/game.types';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  wallet: Wallet | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setWallet: (wallet: Wallet | null) => void;
  fetchUserData: (userId: string) => Promise<void>;
  initializeAuth: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  wallet: null,
  loading: false,
  error: null,
  initialized: false,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setWallet: (wallet) => set({ wallet }),
  clearError: () => set({ error: null }),

  fetchUserData: async (userId) => {
    try {
      set({ loading: true, error: null });
      
      // 1. Lấy thông tin user mở rộng
      const { data: userData, error: userErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (userErr) throw userErr;

      // 2. Lấy profile
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
        
      if (profileErr) throw profileErr;

      // 3. Lấy ví xu
      const { data: walletData, error: walletErr } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();
        
      if (walletErr) throw walletErr;

      set({
        user: userData as User,
        profile: profileData as Profile,
        wallet: walletData as Wallet,
        loading: false
      });
    } catch (err: any) {
      console.error('Lỗi khi fetch dữ liệu người dùng:', err);
      set({ error: err.message, loading: false });
    }
  },

  initializeAuth: async () => {
    if (get().initialized) return;
    try {
      set({ loading: true });
      
      // Kiểm tra session hiện tại từ Supabase Auth
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        await get().fetchUserData(session.user.id);
      }
      
      // Đăng ký lắng nghe thay đổi trạng thái Auth của Supabase
      supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (event === 'SIGNED_IN' && currentSession?.user) {
          await get().fetchUserData(currentSession.user.id);
        } else if (event === 'SIGNED_OUT') {
          set({ user: null, profile: null, wallet: null });
        }
      });

      set({ initialized: true, loading: false });
    } catch (err: any) {
      set({ error: err.message, initialized: true, loading: false });
    }
  },

  signOut: async () => {
    try {
      set({ loading: true });
      await supabase.auth.signOut();
      set({ user: null, profile: null, wallet: null, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  }
}));
