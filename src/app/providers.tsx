import React, { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Loading } from '@/components/ui/Loading';

interface ProvidersProps {
  children: React.ReactNode;
}

export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  const { initializeAuth, initialized, loading } = useAuthStore();

  useEffect(() => {
    // Tự động nạp trạng thái phiên đăng nhập của Supabase khi khởi chạy
    initializeAuth();
  }, []);

  if (!initialized) {
    return <Loading fullPage />;
  }

  return <>{children}</>;
};
