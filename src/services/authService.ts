import { supabase } from './supabaseClient';

export const authService = {
  // 1. Đăng ký tài khoản (Native Supabase Email/Pass)
  async register(email: string, username: string, pass: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          username: username,
          display_name: username
        }
      }
    });

    if (error) throw error;
    return data;
  },

  // 2. Đăng nhập hệ thống
  async login(email: string, pass: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass
    });

    if (error) throw error;
    return data;
  },

  // 3. Đăng xuất
  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // 4. Lấy phiên hiện tại
  async getCurrentSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  }
};
