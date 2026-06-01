import { CoinTransaction, Profile, Wallet } from '@/types/game.types';
import { supabase } from './supabaseClient';

export const walletService = {
  // 1. Lấy thông tin ví hiện tại
  async getWallet(): Promise<Wallet> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Chưa đăng nhập');

    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) throw error;
    return data as Wallet;
  },

  // 2. Lấy danh sách biến động số dư ví
  async getTransactionHistory(): Promise<CoinTransaction[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Chưa đăng nhập');

    const { data, error } = await supabase
      .from('coin_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return data as CoinTransaction[];
  },

  // 3. Lấy bảng xếp hạng (Leaderboard) người chơi thắng nhiều nhất, loại bỏ admin
  async getLeaderboard(): Promise<Profile[]> {
    // Thử query có JOIN users để lọc admin
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          user_id, 
          display_name, 
          avatar_url, 
          total_win, 
          total_loss, 
          win_streak, 
          max_win_streak,
          users!profiles_user_id_fkey (
            role
          )
        `)
        .order('total_win', { ascending: false })
        .limit(20);

      if (!error && data) {
        return (data || [])
          .filter((item: any) => item.users?.role !== 'admin')
          .slice(0, 10) as unknown as Profile[];
      }
    } catch {
      // Ignore - fallback below
    }

    // Fallback: Query đơn giản không JOIN users (nếu cột role chưa tồn tại)
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        user_id, 
        display_name, 
        avatar_url, 
        total_win, 
        total_loss, 
        win_streak, 
        max_win_streak
      `)
      .order('total_win', { ascending: false })
      .limit(10);

    if (error) throw error;
    return (data || []) as unknown as Profile[];
  }
};
