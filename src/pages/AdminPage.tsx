import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabaseClient';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Loading } from '@/components/ui/Loading';
import { Crown, Shield, Search, LogOut, Coins, Key, UserX, UserCheck, ShieldAlert, Award } from 'lucide-react';

interface AdminUserDetail {
  id: string;
  email: string;
  username: string;
  status: 'active' | 'suspended';
  role: 'user' | 'admin';
  created_at: string;
  balance: number;
  total_win: number;
  total_loss: number;
  win_streak: number;
  max_win_streak: number;
}

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentAdmin, signOut } = useAuthStore();
  const [users, setUsers] = useState<AdminUserDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // States for search and filter
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');

  // Modals state
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  
  const [showCoinsModal, setShowCoinsModal] = useState(false);
  const [coinsAmount, setCoinsAmount] = useState('');
  const [coinsReason, setCoinsReason] = useState('Admin cộng xu hệ thống');
  
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch users list
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: rpcError } = await supabase.rpc('admin_get_users_list');
      
      if (rpcError) throw rpcError;
      
      setUsers((data || []) as AdminUserDetail[]);
    } catch (err: any) {
      console.error('Lỗi khi lấy danh sách user:', err);
      setError(err.message || 'Không thể tải danh sách tài khoản');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users list
  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Calculated Stats
  const totalUsersCount = users.length;
  const activeUsersCount = users.filter((u) => u.status === 'active').length;
  const suspendedUsersCount = users.filter((u) => u.status === 'suspended').length;
  const totalCoinsInSystem = users.reduce((acc, curr) => acc + curr.balance, 0);

  // Action: Add Coins
  const handleAddCoins = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    const amount = parseInt(coinsAmount);
    if (isNaN(amount) || amount <= 0) {
      setActionError('Số xu cộng thêm phải lớn hơn 0');
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);

      const { data, error: rpcError } = await supabase.rpc('admin_add_coins', {
        p_user_id: selectedUser.id,
        p_amount: amount,
        p_description: coinsReason.trim() || 'Admin cộng xu hệ thống'
      });

      if (rpcError) throw rpcError;

      // Update state locally
      setUsers((prev) =>
        prev.map((u) => (u.id === selectedUser.id ? { ...u, balance: data.new_balance } : u))
      );

      setShowCoinsModal(false);
      setCoinsAmount('');
      setCoinsReason('Admin cộng xu hệ thống');
      setSelectedUser(null);
    } catch (err: any) {
      setActionError(err.message || 'Lỗi khi cộng xu');
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (newPassword.length < 6) {
      setActionError('Mật khẩu mới phải từ 6 ký tự trở lên');
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);

      const { error: rpcError } = await supabase.rpc('admin_change_password', {
        p_user_id: selectedUser.id,
        p_new_password: newPassword
      });

      if (rpcError) throw rpcError;

      setShowPasswordModal(false);
      setNewPassword('');
      setSelectedUser(null);
      alert('Đã thay đổi mật khẩu tài khoản thành công!');
    } catch (err: any) {
      setActionError(err.message || 'Lỗi khi thay đổi mật khẩu');
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Toggle Status
  const handleToggleStatus = async (userToToggle: AdminUserDetail) => {
    if (userToToggle.id === currentAdmin?.id) {
      alert('Bạn không thể tự khóa tài khoản quản trị của chính mình!');
      return;
    }

    const nextStatus = userToToggle.status === 'active' ? 'suspended' : 'active';
    const message = nextStatus === 'suspended' 
      ? `Bạn có chắc chắn muốn khóa tài khoản "${userToToggle.username}" không?`
      : `Bạn có muốn mở khóa tài khoản "${userToToggle.username}" không?`;

    if (!confirm(message)) return;

    try {
      setLoading(true);
      const { data, error: rpcError } = await supabase.rpc('admin_toggle_user_status', {
        p_user_id: userToToggle.id,
        p_status: nextStatus
      });

      if (rpcError) throw rpcError;

      setUsers((prev) =>
        prev.map((u) => (u.id === userToToggle.id ? { ...u, status: data.new_status } : u))
      );
    } catch (err: any) {
      alert(err.message || 'Lỗi khi thay đổi trạng thái người dùng');
    } finally {
      setLoading(false);
    }
  };

  // Action: Delete User
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (selectedUser.id === currentAdmin?.id) {
      setActionError('Bạn không thể tự xóa tài khoản quản trị của chính mình!');
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);

      const { error: rpcError } = await supabase.rpc('admin_delete_user', {
        p_user_id: selectedUser.id
      });

      if (rpcError) throw rpcError;

      // Remove from local state list
      setUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
      setShowDeleteModal(false);
      setSelectedUser(null);
    } catch (err: any) {
      setActionError(err.message || 'Lỗi khi xóa tài khoản');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-4 md:p-6 bg-linear-to-b from-slate-950 via-slate-900 to-crimson-950/20">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-slate-800/80 pb-6">
        <div className="flex items-center gap-3 text-left">
          <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 shadow-lg shadow-yellow-900/10">
            <Crown className="w-6 h-6 text-yellow-400 fill-yellow-500/10" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-100 font-heading">
              Admin Dashboard
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Hệ thống theo dõi ví xu, quản trị tài khoản và kiểm soát an toàn Bầu Cua Online.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={fetchUsers}
            className="bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200"
          >
            Làm mới dữ liệu
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={async () => {
              if (confirm('Bạn có thực sự muốn đăng xuất không?')) {
                await signOut();
                navigate('/login');
              }
            }}
            className="p-2 md:px-3.5 md:py-2 text-rose-400 hover:bg-rose-950/20 hover:text-rose-300 rounded-xl flex items-center gap-1.5 border border-rose-950/40 text-xs font-bold"
          >
            <LogOut size={16} />
            Đăng xuất
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        
        <div className="glass-panel border border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Tổng người chơi</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl md:text-3xl font-black text-slate-100">{totalUsersCount}</span>
            <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300">Tài khoản</span>
          </div>
        </div>

        <div className="glass-panel border border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Đang hoạt động</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl md:text-3xl font-black text-emerald-400">{activeUsersCount}</span>
            <span className="text-xs bg-emerald-950/40 px-2 py-0.5 rounded text-emerald-300">Online</span>
          </div>
        </div>

        <div className="glass-panel border border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Đang bị khóa</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl md:text-3xl font-black text-rose-400">{suspendedUsersCount}</span>
            <span className="text-xs bg-rose-950/40 px-2 py-0.5 rounded text-rose-300">Bị chặn</span>
          </div>
        </div>

        <div className="glass-panel border border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Tổng xu hệ thống</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl md:text-3xl font-black text-amber-400">{totalCoinsInSystem.toLocaleString('vi-VN')}</span>
            <span className="text-xs bg-amber-950/40 px-2 py-0.5 rounded text-amber-300">Xu</span>
          </div>
        </div>

      </div>

      {/* Filtering Panel */}
      <div className="glass-panel border border-slate-800/80 p-4 rounded-2xl mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Tìm theo username hoặc shadow email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/60 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-100 outline-hidden transition-all duration-150 placeholder:text-slate-600"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto justify-end">
          
          <div className="flex items-center gap-1.5 bg-slate-900/40 px-2 py-1.5 rounded-xl border border-slate-800/60 text-xs">
            <span className="text-slate-500 font-medium">Vai trò:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="bg-transparent text-slate-200 outline-hidden border-none cursor-pointer pr-1 focus:ring-0"
            >
              <option value="all" className="bg-slate-950 text-slate-100">Tất cả</option>
              <option value="user" className="bg-slate-950 text-slate-100">Người chơi</option>
              <option value="admin" className="bg-slate-950 text-slate-100">Admin</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900/40 px-2 py-1.5 rounded-xl border border-slate-800/60 text-xs">
            <span className="text-slate-500 font-medium">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-slate-200 outline-hidden border-none cursor-pointer pr-1 focus:ring-0"
            >
              <option value="all" className="bg-slate-950 text-slate-100">Tất cả</option>
              <option value="active" className="bg-slate-950 text-slate-100">Hoạt động</option>
              <option value="suspended" className="bg-slate-950 text-slate-100">Bị khóa</option>
            </select>
          </div>

        </div>

      </div>

      {/* Main Grid / User List Table */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20">
          <Loading size="lg" />
          <span className="text-slate-500 text-xs mt-3">Đang tải danh sách người chơi...</span>
        </div>
      ) : error ? (
        <div className="glass-panel border border-rose-950/40 p-8 rounded-2xl flex flex-col items-center justify-center text-center max-w-lg mx-auto py-16">
          <ShieldAlert className="w-12 h-12 text-rose-500 mb-3" />
          <h3 className="font-extrabold text-lg text-slate-200">Không có quyền truy cập hoặc lỗi kết nối</h3>
          <p className="text-slate-500 text-sm mt-1">{error}</p>
          <Button variant="secondary" className="mt-6" onClick={() => navigate('/lobby')}>
            Quay về Sảnh
          </Button>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="glass-panel border border-slate-800/80 rounded-2xl py-20 flex flex-col items-center justify-center text-center">
          <Search className="w-12 h-12 text-slate-700 mb-3" />
          <h3 className="font-bold text-slate-400">Không tìm thấy người chơi nào</h3>
          <p className="text-slate-600 text-xs mt-1">Hãy kiểm tra lại từ khóa tìm kiếm hoặc bộ lọc.</p>
        </div>
      ) : (
        /* Responsive list (cards for mobile, table for desktop) */
        <div className="flex-1 flex flex-col">
          
          {/* Table Container (Desktop Only) */}
          <div className="hidden md:block glass-panel border border-slate-800/60 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                    <th className="py-4 px-5">Tài khoản (Username)</th>
                    <th className="py-4 px-4">Ví Xu</th>
                    <th className="py-4 px-4 text-center">Tỉ Lệ Thắng</th>
                    <th className="py-4 px-4 text-center">Chuỗi Thắng</th>
                    <th className="py-4 px-4 text-center">Trạng thái</th>
                    <th className="py-4 px-4">Quyền hạn</th>
                    <th className="py-4 px-5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredUsers.map((u) => {
                    const totalWinLoss = u.total_win + u.total_loss;
                    const winRate = totalWinLoss > 0 ? ((u.total_win / totalWinLoss) * 100).toFixed(0) : '0';
                    const isSelf = u.id === currentAdmin?.id;

                    return (
                      <tr key={u.id} className="hover:bg-slate-900/20 transition-colors duration-100">
                        <td className="py-4 px-5">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-slate-100 text-sm flex items-center gap-1.5">
                              {u.username}
                              {u.role === 'admin' && <Shield className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400/20" />}
                              {isSelf && <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">Tôi</span>}
                            </span>
                            <span className="text-slate-500 text-xs tracking-tight mt-0.5">{u.email}</span>
                          </div>
                        </td>
                        
                        <td className="py-4 px-4">
                          <span className="font-heading font-extrabold text-amber-400 text-sm flex items-center gap-1">
                            {u.balance.toLocaleString('vi-VN')}
                            <span className="text-[10px] text-amber-500 font-normal">Xu</span>
                          </span>
                        </td>

                        <td className="py-4 px-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-extrabold text-slate-200">{winRate}%</span>
                            <span className="text-slate-500 text-[10px] tracking-tight">{u.total_win} thắng / {u.total_loss} thua</span>
                          </div>
                        </td>

                        <td className="py-4 px-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-slate-200 text-xs flex items-center gap-1">
                              <Award className="w-3.5 h-3.5 text-amber-400" />
                              Streak: {u.win_streak}
                            </span>
                            <span className="text-slate-500 text-[9px] mt-0.5">Kỷ lục: {u.max_win_streak}</span>
                          </div>
                        </td>

                        <td className="py-4 px-4 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            u.status === 'active' 
                              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/60' 
                              : 'bg-rose-950/40 text-rose-400 border border-rose-900/60'
                          }`}>
                            {u.status === 'active' ? 'Hoạt động' : 'Bị khóa'}
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <span className={`text-xs ${u.role === 'admin' ? 'text-yellow-400 font-bold' : 'text-slate-400'}`}>
                            {u.role === 'admin' ? 'Quản trị viên' : 'Người chơi'}
                          </span>
                        </td>

                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            
                            {/* Cộng Xu */}
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Cộng Xu"
                              onClick={() => {
                                setSelectedUser(u);
                                setShowCoinsModal(true);
                              }}
                              className="text-amber-400 hover:bg-slate-800 hover:text-amber-300 p-1.5 rounded-lg"
                            >
                              <Coins className="w-4 h-4" />
                            </Button>

                            {/* Đổi Mật Khẩu */}
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Đổi mật khẩu"
                              onClick={() => {
                                setSelectedUser(u);
                                setShowPasswordModal(true);
                              }}
                              className="text-cyan-400 hover:bg-slate-800 hover:text-cyan-300 p-1.5 rounded-lg"
                            >
                              <Key className="w-4 h-4" />
                            </Button>

                            {/* Khóa / Mở Khóa */}
                            {!isSelf && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title={u.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa'}
                                onClick={() => handleToggleStatus(u)}
                                className={`${u.status === 'active' ? 'text-rose-400 hover:text-rose-300' : 'text-emerald-400 hover:text-emerald-300'} hover:bg-slate-800 p-1.5 rounded-lg`}
                              >
                                {u.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                              </Button>
                            )}

                            {/* Xóa tài khoản */}
                            {!isSelf && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Xóa vĩnh viễn"
                                onClick={() => {
                                  setSelectedUser(u);
                                  setShowDeleteModal(true);
                                }}
                                className="text-red-400 hover:bg-slate-800 hover:text-red-300 p-1.5 rounded-lg"
                              >
                                <UserX className="w-4 h-4" />
                              </Button>
                            )}

                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cards Layout (Mobile Only) */}
          <div className="flex flex-col gap-4 md:hidden">
            {filteredUsers.map((u) => {
              const isSelf = u.id === currentAdmin?.id;
              
              return (
                <div key={u.id} className="glass-panel border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3.5">
                  
                  {/* Account detail */}
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="font-extrabold text-slate-100 flex items-center gap-1.5">
                        {u.username}
                        {u.role === 'admin' && <Shield className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400/20" />}
                        {isSelf && <span className="text-[9px] bg-slate-800 text-slate-400 px-1 py-0.5 rounded">Tôi</span>}
                      </span>
                      <span className="text-slate-500 text-xs mt-0.5">{u.email}</span>
                    </div>

                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      u.status === 'active' 
                        ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/60' 
                        : 'bg-rose-950/40 text-rose-400 border border-rose-900/60'
                    }`}>
                      {u.status === 'active' ? 'Hoạt động' : 'Bị khóa'}
                    </span>
                  </div>

                  {/* Wallet & Stats */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-900/30 p-2.5 rounded-xl border border-slate-900/60 text-center">
                    <div className="flex flex-col">
                      <span className="text-slate-500 text-[10px]">Ví Xu</span>
                      <span className="text-amber-400 font-extrabold text-xs font-heading mt-0.5">
                        {u.balance.toLocaleString('vi-VN')}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-500 text-[10px]">Win Rate</span>
                      <span className="text-slate-200 font-extrabold text-xs mt-0.5">
                        {u.total_win + u.total_loss > 0 ? ((u.total_win / (u.total_win + u.total_loss)) * 100).toFixed(0) : '0'}%
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-500 text-[10px]">Streak</span>
                      <span className="text-slate-200 font-extrabold text-xs mt-0.5 flex items-center justify-center gap-0.5">
                        🔥{u.win_streak}
                      </span>
                    </div>
                  </div>

                  {/* Actions Drawer Bar */}
                  <div className="flex gap-2 justify-end pt-2 border-t border-slate-900/40">
                    
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(u);
                        setShowCoinsModal(true);
                      }}
                      className="bg-slate-900 border border-slate-800 text-amber-400 hover:text-amber-300 text-xs px-2.5 py-1.5 rounded-xl"
                    >
                      + Cộng Xu
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(u);
                        setShowPasswordModal(true);
                      }}
                      className="bg-slate-900 border border-slate-800 text-cyan-400 hover:text-cyan-300 text-xs px-2.5 py-1.5 rounded-xl"
                    >
                      Đổi MK
                    </Button>

                    {!isSelf && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleToggleStatus(u)}
                        className={`bg-slate-900 border border-slate-800 ${
                          u.status === 'active' ? 'text-rose-400' : 'text-emerald-400'
                        } text-xs px-2.5 py-1.5 rounded-xl`}
                      >
                        {u.status === 'active' ? 'Khóa' : 'Mở'}
                      </Button>
                    )}

                    {!isSelf && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(u);
                          setShowDeleteModal(true);
                        }}
                        className="bg-slate-900 border border-slate-800 text-red-500 hover:text-red-400 text-xs px-2 py-1.5 rounded-xl"
                      >
                        Xóa
                      </Button>
                    )}

                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* Modal 1: Add Coins */}
      <Modal
        isOpen={showCoinsModal}
        onClose={() => {
          setShowCoinsModal(false);
          setSelectedUser(null);
          setActionError(null);
        }}
        title={`Cộng Xu - @${selectedUser?.username}`}
      >
        <form onSubmit={handleAddCoins} className="flex flex-col gap-4 mt-2">
          
          <div>
            <label className="text-slate-400 text-xs font-semibold block mb-1">Số lượng xu cần cộng:</label>
            <Input
              type="number"
              placeholder="Ví dụ: 5000"
              value={coinsAmount}
              onChange={(e) => setCoinsAmount(e.target.value)}
              className="bg-slate-950 border-slate-800"
              required
            />
          </div>

          <div>
            <label className="text-slate-400 text-xs font-semibold block mb-1">Lý do điều chỉnh (Log transaction):</label>
            <Input
              type="text"
              placeholder="Ví dụ: Khuyến mãi sự kiện, đền bù hệ thống..."
              value={coinsReason}
              onChange={(e) => setCoinsReason(e.target.value)}
              className="bg-slate-950 border-slate-800"
              required
            />
          </div>

          {actionError && (
            <div className="bg-rose-950/40 border border-rose-900/60 p-3 rounded-xl text-rose-400 text-xs font-medium">
              {actionError}
            </div>
          )}

          <div className="flex gap-3 justify-end mt-4 border-t border-slate-900/80 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowCoinsModal(false);
                setSelectedUser(null);
                setActionError(null);
              }}
              disabled={actionLoading}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={actionLoading}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold"
            >
              {actionLoading ? 'Đang cộng xu...' : 'Xác nhận cộng xu'}
            </Button>
          </div>

        </form>
      </Modal>

      {/* Modal 2: Change Password */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setSelectedUser(null);
          setActionError(null);
        }}
        title={`Thay đổi mật khẩu - @${selectedUser?.username}`}
      >
        <form onSubmit={handleChangePassword} className="flex flex-col gap-4 mt-2">
          
          <div>
            <label className="text-slate-400 text-xs font-semibold block mb-1">Mật khẩu mới (Tối thiểu 6 ký tự):</label>
            <Input
              type="password"
              placeholder="Nhập mật khẩu mới an toàn..."
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-slate-950 border-slate-800"
              required
            />
          </div>

          {actionError && (
            <div className="bg-rose-950/40 border border-rose-900/60 p-3 rounded-xl text-rose-400 text-xs font-medium">
              {actionError}
            </div>
          )}

          <div className="flex gap-3 justify-end mt-4 border-t border-slate-900/80 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowPasswordModal(false);
                setSelectedUser(null);
                setActionError(null);
              }}
              disabled={actionLoading}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={actionLoading}
              className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-extrabold"
            >
              {actionLoading ? 'Đang thay đổi...' : 'Cập nhật mật khẩu'}
            </Button>
          </div>

        </form>
      </Modal>

      {/* Modal 3: Delete Account Confirmation */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedUser(null);
          setActionError(null);
        }}
        title={`Cảnh báo xóa tài khoản - @${selectedUser?.username}`}
      >
        <div className="flex flex-col gap-4 mt-2">
          
          <div className="flex items-center gap-3 bg-red-950/30 border border-red-900/60 p-4 rounded-xl text-red-400 text-sm">
            <ShieldAlert className="w-8 h-8 shrink-0" />
            <div>
              <p className="font-extrabold">HÀNH ĐỘNG KHÔNG THỂ KHÔI PHỤC!</p>
              <p className="text-xs text-red-500 mt-0.5">
                Xóa tài khoản này sẽ xóa vĩnh viễn mọi dữ liệu giao dịch, cược, thông tin ví xu và hồ sơ trong cơ sở dữ liệu. Người chơi sẽ không thể đăng nhập lại.
              </p>
            </div>
          </div>

          <p className="text-slate-300 text-sm">
            Bạn có thực sự chắc chắn muốn xóa vĩnh viễn tài khoản người chơi **@{selectedUser?.username}** không?
          </p>

          {actionError && (
            <div className="bg-rose-950/40 border border-rose-900/60 p-3 rounded-xl text-rose-400 text-xs font-medium">
              {actionError}
            </div>
          )}

          <div className="flex gap-3 justify-end mt-4 border-t border-slate-900/80 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedUser(null);
                setActionError(null);
              }}
              disabled={actionLoading}
            >
              Hủy bỏ
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={actionLoading}
              onClick={handleDeleteUser}
              className="bg-red-500 hover:bg-red-600 text-white font-extrabold"
            >
              {actionLoading ? 'Đang xóa...' : 'Xác nhận xóa tài khoản'}
            </Button>
          </div>

        </div>
      </Modal>

    </div>
  );
};
