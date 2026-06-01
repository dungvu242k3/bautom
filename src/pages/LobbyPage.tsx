import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useRoomStore } from '@/stores/roomStore';
import { roomService } from '@/services/roomService';
import { walletService } from '@/services/walletService';
import { RoomList } from '@/components/lobby/RoomList';
import { CreateRoomModal } from '@/components/lobby/CreateRoomModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { formatCoin } from '@/utils/formatCoin';
import { LogOut, Plus, RefreshCw, Trophy, Sparkles, User, History, Play, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Room, Profile, CoinTransaction } from '@/types/game.types';

export const LobbyPage: React.FC = () => {
  const { user, profile, wallet, signOut, fetchUserData } = useAuthStore();
  const { setActiveRoom } = useRoomStore();
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [leaderboard, setLeaderboard] = useState<Profile[]>([]);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const navigate = useNavigate();

  // Nạp dữ liệu sảnh chờ
  const loadLobbyData = async () => {
    try {
      setRefreshing(true);
      const publicRooms = await roomService.getPublicRooms();
      setRooms(publicRooms);

      const topPlayers = await walletService.getLeaderboard();
      setLeaderboard(topPlayers);

      if (user) {
        await fetchUserData(user.id);
        const txs = await walletService.getTransactionHistory();
        setTransactions(txs.slice(0, 5)); // Lấy 5 giao dịch gần nhất
      }
    } catch (err) {
      console.error('Không thể nạp dữ liệu sảnh chờ:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    // Nếu tài khoản là Admin, tự động chuyển hướng trực tiếp đến Dashboard quản lý
    if (user.role === 'admin') {
      navigate('/admin');
      return;
    }
    
    loadLobbyData();
  }, [user?.id, user?.role]);

  // Hành động tham gia phòng qua danh sách hoặc qua ID
  const handleJoinRoom = async (roomId: string) => {
    try {
      setLoading(true);
      setJoinError(null);
      const room = await roomService.joinRoom(roomId);
      setActiveRoom(room);
      navigate(`/room/${room.id}`);
    } catch (err: any) {
      setJoinError(err.message || 'Lỗi khi vào phòng chơi');
    } finally {
      setLoading(false);
    }
  };

  // Hành động tham gia phòng riêng tư qua Mã Code
  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim() || roomCode.length !== 6) return;

    try {
      setLoading(true);
      setJoinError(null);
      const room = await roomService.joinRoom(roomCode.trim().toUpperCase());
      setActiveRoom(room);
      navigate(`/room/${room.id}`);
    } catch (err: any) {
      setJoinError(err.message || 'Mã phòng không chính xác hoặc phòng đã đầy!');
    } finally {
      setLoading(false);
    }
  };

  // Chơi nhanh (Quick Match): Tự động vào phòng cược public trống đầu tiên
  const handleQuickMatch = async () => {
    if (rooms.length === 0) {
      alert('Hiện tại không có phòng chơi public nào trống. Bạn vui lòng tự tạo phòng mới nhé!');
      return;
    }
    await handleJoinRoom(rooms[0].id);
  };

  const handleCreateRoom = async (
    name: string,
    isPrivate: boolean,
    maxPlayers: number,
    minBet: number,
    maxBet: number,
    betDuration: number
  ) => {
    const room = await roomService.createRoom(name, isPrivate, maxPlayers, minBet, maxBet, betDuration);
    setActiveRoom(room);
    navigate(`/room/${room.id}`);
  };

  if (!user || !profile || !wallet) {
    return <Loading fullPage />;
  }

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 bg-linear-to-b from-slate-950 via-slate-900 to-slate-950">
      
      {/* Header Sảnh */}
      <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800/60 pb-5 mb-6">
        
        {/* User Card */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <User size={22} />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-base font-bold text-slate-200 tracking-wide font-heading">
              {profile.display_name}
            </span>
            <span className="text-sm font-black text-amber-400 mt-0.5">
              {formatCoin(wallet.balance)}
            </span>
          </div>
        </div>

        {/* Title */}
        <h2 className="hidden lg:block text-2xl font-black text-amber-400 font-heading tracking-widest uppercase">
          SẢNH CHỜ PHÒNG CƯỢC
        </h2>

        {/* Action Controls */}
        <div className="flex flex-wrap gap-2 items-center w-full md:w-auto justify-end">
          <Button variant="ghost" onClick={loadLobbyData} disabled={refreshing} className="p-2.5">
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </Button>
          {user?.role === 'admin' && (
            <Button
              variant="secondary"
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 border-yellow-500/40 text-yellow-400 hover:text-yellow-300 bg-yellow-500/10 hover:bg-yellow-500/20"
            >
              <Crown size={18} className="fill-yellow-500/20" />
              Admin Panel
            </Button>
          )}
          <Button variant="secondary" onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2">
            <Plus size={18} />
            Tạo phòng mới
          </Button>
          <Button variant="gold" onClick={handleQuickMatch} className="flex items-center gap-2">
            <Play size={18} className="fill-current" />
            Vào chơi nhanh
          </Button>
          <Button variant="ghost" onClick={signOut} className="p-2.5 text-rose-400 hover:bg-rose-950/20 hover:text-rose-300">
            <LogOut size={18} />
          </Button>
        </div>

      </div>

      {/* Main Lobby Container */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Columns - Danh sách phòng chơi */}
        <div className="lg:col-span-3 flex flex-col gap-6 text-left">
          
          {/* Nhập mã phòng Private */}
          <div className="glass-card rounded-2xl p-5 border border-slate-800/60">
            <h3 className="text-base font-bold text-amber-400 font-heading mb-4 flex items-center gap-2">
              <Sparkles size={18} />
              VÀO PHÒNG RIÊNG TƯ
            </h3>
            <form onSubmit={handleJoinByCode} className="flex flex-col sm:flex-row gap-3">
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Nhập mã phòng Code (6 chữ số)..."
                maxLength={6}
                required
                className="flex-1 px-4 py-3 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg text-sm text-slate-200 focus:outline-none placeholder-slate-500 min-h-[44px]"
              />
              <Button type="submit" variant="primary" loading={loading} className="min-w-[140px]">
                Vào phòng
              </Button>
            </form>
            {joinError && (
              <span className="text-xs text-rose-400 font-bold mt-2 block">{joinError}</span>
            )}
          </div>

          {/* Danh sách phòng public */}
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-bold text-slate-200 font-heading tracking-wide">
              DANH SÁCH PHÒNG CÔNG KHAI
            </h3>
            <RoomList rooms={rooms} onJoinRoom={handleJoinRoom} />
          </div>

        </div>

        {/* Right Columns - BXH & Thống kê */}
        <div className="flex flex-col gap-6 text-left">
          
          {/* Lịch sử cược gần nhất */}
          <div className="glass-card rounded-2xl p-5 border border-slate-800/60">
            <h3 className="text-base font-bold text-slate-300 font-heading mb-4 flex items-center gap-2 border-b border-slate-800/80 pb-2">
              <History size={18} className="text-slate-400" />
              LỊCH SỬ BIẾN ĐỘNG
            </h3>
            <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-1">
              {transactions.length === 0 ? (
                <span className="text-xs text-slate-500 italic block py-4 text-center">Chưa ghi nhận giao dịch nào.</span>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="flex justify-between items-center text-xs border-b border-slate-900 pb-2">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-300">
                        {tx.type === 'initial_bonus' ? 'Tân thủ khởi nghiệp' : tx.type === 'place_bet' ? 'Đặt cược linh vật' : 'Thắng cược thưởng'}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1">
                        {new Date(tx.created_at).toLocaleTimeString('vi-VN')}
                      </span>
                    </div>
                    <span className={`font-black ${tx.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount} xu
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bảng xếp hạng Top win */}
          <div className="glass-card rounded-2xl p-5 border border-slate-800/60">
            <h3 className="text-base font-bold text-amber-400 font-heading mb-4 flex items-center gap-2 border-b border-slate-800/80 pb-2">
              <Trophy size={18} className="text-amber-500" />
              BẢNG XẾP HẠNG CAO THỦ
            </h3>
            <div className="flex flex-col gap-3">
              {leaderboard.length === 0 ? (
                <span className="text-xs text-slate-500 italic block py-4 text-center">Chưa có người chơi nào xếp hạng.</span>
              ) : (
                leaderboard.map((player, idx) => (
                  <div key={player.user_id} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className={`font-black w-5 h-5 flex items-center justify-center rounded-full text-[10px] ${
                        idx === 0 ? 'bg-amber-400 text-slate-950 font-black' : idx === 1 ? 'bg-slate-300 text-slate-950 font-black' : idx === 2 ? 'bg-amber-700 text-slate-100 font-black' : 'text-slate-500'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-300">{player.display_name}</span>
                    </div>
                    <span className="font-bold text-amber-400">{formatCoin(player.total_win).replace(' xu', '')}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Modal Tạo phòng */}
      <CreateRoomModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateRoom}
      />

    </div>
  );
};
