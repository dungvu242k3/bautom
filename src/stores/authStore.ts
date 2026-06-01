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

      // Lấy thông tin auth user để dùng khi cần tạo dữ liệu thiếu
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      // 1. Lấy thông tin user mở rộng (dùng maybeSingle để tránh lỗi 406)
      let { data: userData, error: userErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
        
      if (userErr) throw userErr;

      // Nếu user chưa tồn tại trong bảng public.users → tự tạo
      if (!userData && authUser) {
        const username = authUser.user_metadata?.username 
          || authUser.email?.split('@')[0] 
          || 'player';
        const email = authUser.email || `${username}@bautom.local`;
        
        console.log('[authStore] Tự tạo row users cho:', userId, username);
        const { data: newUser, error: insertErr } = await supabase
          .from('users')
          .insert({ id: userId, email, username })
          .select()
          .single();
        
        if (insertErr) {
          console.error('[authStore] Lỗi tạo user:', insertErr);
          throw insertErr;
        }
        userData = newUser;
      }

      // 2. Lấy profile (dùng maybeSingle)
      let { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
        
      if (profileErr) throw profileErr;

      // Nếu profile chưa tồn tại → tự tạo
      if (!profileData && userData) {
        console.log('[authStore] Tự tạo row profiles cho:', userId);
        const { data: newProfile, error: insertErr } = await supabase
          .from('profiles')
          .insert({ user_id: userId, display_name: userData.username })
          .select()
          .single();
        
        if (insertErr) {
          console.error('[authStore] Lỗi tạo profile:', insertErr);
          throw insertErr;
        }
        profileData = newProfile;
      }

      // 3. Lấy ví xu (dùng maybeSingle)
      let { data: walletData, error: walletErr } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
        
      if (walletErr) throw walletErr;

      // Nếu wallet chưa tồn tại → tự tạo với 1000 xu
      if (!walletData) {
        console.log('[authStore] Tự tạo row wallets cho:', userId);
        const { data: newWallet, error: insertErr } = await supabase
          .from('wallets')
          .insert({ user_id: userId, balance: 1000 })
          .select()
          .single();
        
        if (insertErr) {
          console.error('[authStore] Lỗi tạo wallet:', insertErr);
          throw insertErr;
        }
        walletData = newWallet;
      }

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
