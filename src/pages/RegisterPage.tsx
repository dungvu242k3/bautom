import React, { useState } from 'react';
import { authService } from '@/services/authService';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useNavigate, Link } from 'react-router-dom';

export const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password || !confirmPassword) return;

    const cleanUsername = username.trim();

    // 1. Tạo Email ảo ẩn bên dưới để kết nối với Supabase Auth mặc định
    const shadowEmail = `${cleanUsername.toLowerCase()}@bautom.com`;

    // 2. Kiểm tra độ dài mật khẩu (Supabase GoTrue yêu cầu tối thiểu 6 ký tự ở server-side)
    if (password.length < 6) {
      setError('Mật khẩu tối thiểu phải dài 6 ký tự!');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không trùng khớp!');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Đăng ký sử dụng shadowEmail
      await authService.register(shadowEmail, cleanUsername, password);
      
      alert('Tạo tài khoản thành công! Bạn có thể dùng tài khoản này để đăng nhập ngay.');
      navigate('/login');
    } catch (err: any) {
      console.error('Đăng ký thất bại:', err);
      if (err.message.includes('User already registered') || err.message.includes('already exists')) {
        setError('Tên tài khoản này đã được sử dụng! Vui lòng chọn tên khác.');
      } else {
        setError(err.message || 'Có lỗi xảy ra khi tạo tài khoản');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 bg-linear-to-tr from-slate-950 via-slate-900 to-crimson-950/20">
      
      <div className="w-full max-w-md glass-panel rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-800 flex flex-col items-center animate-in fade-in zoom-in-95 duration-250">
        
        {/* Header Đăng Ký */}
        <div className="flex flex-col items-center gap-1 mb-6 select-none text-center">
          <h2 className="text-2xl font-black tracking-widest text-amber-400 font-heading uppercase mb-0">
            TẠO TÀI KHOẢN MỚI
          </h2>
          <p className="text-[11px] text-slate-500 font-semibold tracking-widest uppercase">
            Nhận ngay 1,000 xu vốn khởi nghiệp
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="w-full bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs px-4 py-3 rounded-lg text-left mb-4">
            {error}
          </div>
        )}

        {/* Form Đăng Ký */}
        <form onSubmit={handleRegister} className="w-full flex flex-col gap-4">
          <Input
            label="Tên tài khoản"
            type="text"
            placeholder="Nhập tên tài khoản của bạn..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            maxLength={20}
          />

          <Input
            label="Mật khẩu"
            type="password"
            placeholder="Tối thiểu 6 ký tự..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          <Input
            label="Xác nhận lại mật khẩu"
            type="password"
            placeholder="Nhập lại mật khẩu..."
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          <Button type="submit" variant="gold" className="w-full mt-2" loading={loading}>
            Đăng ký & Nhận 1,000 xu
          </Button>
        </form>

        {/* Link chuyển Đăng Nhập */}
        <div className="mt-5 text-sm text-slate-500 font-medium">
          Đã có tài khoản tham gia?{' '}
          <Link to="/login" className="text-amber-400 hover:text-amber-300 font-bold underline transition-colors">
            Đăng nhập ngay
          </Link>
        </div>

      </div>

    </div>
  );
};
