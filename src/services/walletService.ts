import { supabase } from './supabaseClient';
import { Wallet, CoinTransaction, Profile } from '@/types/game.types';

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
        users:user_id (
          role
        )
      `)
      .order('total_win', { ascending: false });

    if (error) {
      // Fallback: Thử không dùng alias fkey nếu có vấn đề về schema
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('profiles')
        .select(`
          user_id, 
          display_name, 
          avatar_url, 
          total_win, 
          total_loss, 
          win_streak, 
          max_win_streak,
          users (
            role
          )
        `)
        .order('total_win', { ascending: false });

      if (fallbackError) throw fallbackError;
      
      return (fallbackData || [])
        .filter((item: any) => item.users?.role !== 'admin')
        .slice(0, 10) as unknown as Profile[];
    }

    return (data || [])
      .filter((item: any) => (item.users as any)?.role !== 'admin')
      .slice(0, 10) as unknown as Profile[];
  }
};
