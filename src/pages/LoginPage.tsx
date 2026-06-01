import React, { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/authService';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useNavigate, Link } from 'react-router-dom';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { fetchUserData } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    const cleanUsername = username.trim();
    
    // Tự động chuyển đổi Tên tài khoản thành Shadow Email để đăng nhập thông qua Supabase Auth
    let shadowEmail = cleanUsername;
    if (!shadowEmail.includes('@')) {
      shadowEmail = `${cleanUsername.toLowerCase()}@bautom.com`;
    }

    try {
      setLoading(true);
      setError(null);
      
      const { user } = await authService.login(shadowEmail, password);
      
      if (user) {
        await fetchUserData(user.id);
        const updatedUser = useAuthStore.getState().user;
        if (updatedUser?.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/lobby');
        }
      }
    } catch (err: any) {
      console.error('Đăng nhập thất bại:', err);
      // Hiển thị lỗi thân thiện
      if (err.message.includes('Invalid login credentials') || err.message.includes('invalid_grant')) {
        setError('Tên tài khoản hoặc mật khẩu không chính xác!');
      } else {
        setError(err.message || 'Có lỗi xảy ra khi đăng nhập');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 bg-linear-to-tr from-slate-950 via-slate-900 to-crimson-950/20">
      
      <div className="w-full max-w-md glass-panel rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-800 flex flex-col items-center animate-in fade-in zoom-in-95 duration-250">
        
        {/* Logo chữ Bầu Cua */}
        <div className="flex flex-col items-center gap-1 mb-8 select-none">
          <div className="w-16 h-16 rounded-full bg-linear-to-tr from-crimson-800 to-amber-500 flex items-center justify-center border-2 border-yellow-400/40 shadow-lg shadow-crimson-900/30 animate-pulse-subtle">
            <span className="text-yellow-300 font-extrabold text-2xl font-heading">BC</span>
          </div>
          <h1 className="text-3xl font-black tracking-widest text-amber-400 font-heading mt-3 uppercase mb-0">
            BẦU CUA ONLINE
          </h1>
          <p className="text-xs text-slate-500 font-medium font-heading tracking-widest uppercase">
            Hội Tụ Kỳ Tài Realtime
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="w-full bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs px-4 py-3 rounded-lg text-left mb-4">
            {error}
          </div>
        )}

        {/* Form Đăng Nhập */}
        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
          <Input
            label="Tên tài khoản"
            type="text"
            placeholder="Nhập tên tài khoản của bạn..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />

          <Input
            label="Mật khẩu"
            type="password"
            placeholder="Nhập mật khẩu..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <Button type="submit" variant="gold" className="w-full mt-2" loading={loading}>
            Đăng nhập & Chơi ngay
          </Button>
        </form>

        {/* Link chuyển Đăng Ký */}
        <div className="mt-6 text-sm text-slate-500 font-medium">
          Chưa có tài khoản tham gia?{' '}
          <Link to="/register" className="text-amber-400 hover:text-amber-300 font-bold underline transition-colors">
            Đăng ký tài khoản mới
          </Link>
        </div>

      </div>

    </div>
  );
};
