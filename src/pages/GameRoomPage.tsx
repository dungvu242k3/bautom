import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import { useGameRealtime } from '@/hooks/useGameRealtime';
import { useCountdown } from '@/hooks/useCountdown';
import { roomService } from '@/services/roomService';
import { gameService } from '@/services/gameService';
import { supabase } from '@/services/supabaseClient';
import { BettingBoard } from '@/components/game/BettingBoard';
import { BetChip } from '@/components/game/BetChip';
import { DiceArea } from '@/components/game/DiceArea';
import { PlayerSidebar } from '@/components/game/PlayerSidebar';
import { ChatBox } from '@/components/game/ChatBox';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { formatCoin } from '@/utils/formatCoin';
import { BET_CHIPS } from '@/utils/constants';
import { ArrowLeft, MessageSquare, Users, ShieldAlert, Sparkles, Trophy } from 'lucide-react';
import { AnimalType } from '@/types/game.types';

// Biến đếm thời gian dọn dẹp phòng toàn cục chia sẻ giữa các lượt mount (Strict Mode remount)
let globalCleanupTimer: any = null;

export const GameRoomPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const { user, wallet } = useAuthStore();
  const { activeRoom, players, setActiveRoom, setPlayers, removePlayer } = useRoomStore();
  const {
    currentRound,
    bets,
    localBets,
    chatMessages,
    isShaking,
    isRevealing,
    diceResults,
    setRoundState,
    setBets,
    setChatMessages,
    selectChipToBet,
    clearLocalBets,
    confirmLocalBets,
    resetAnimationState
  } = useGameStore();

  const [activeChip, setActiveChip] = useState<number>(50);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [startingRound, setStartingRound] = useState(false);
  const [mobileTab, setMobileTab] = useState<'board' | 'players' | 'chat'>('board');

  // 1. Kết nối Supabase Realtime Channels tự động đồng bộ dữ liệu
  useGameRealtime(roomId || '');

  // 2. Đồng bộ đếm ngược giây chuẩn xác khớp với server (hiệu chỉnh đồng hồ chống lệch giờ)
  const timeLeft = useCountdown(
    currentRound?.phase_ends_at,
    currentRound?.phase_started_at,
    () => {
      // Khi hết giờ, nếu là host, ta có quyền trigger chuyển phase tự động trên database
      if (activeRoom && players.find(p => p.user_id === user?.id)?.is_host && currentRound) {
        handleHostLoopTrigger();
      }
    }
  );

  // Nạp thông tin phòng cược
  const loadRoom = async () => {
    if (!roomId) return;
    try {
      setLoading(true);
      const { room, players: roomPlayers } = await roomService.getRoomDetails(roomId);
      setActiveRoom(room);
      setPlayers(roomPlayers);

      // Lấy chi tiết vòng cược đang hoạt động trong phòng
      if (room.current_round_id) {
        const { data: roundData } = await supabase
          .from('rounds')
          .select('*')
          .eq('id', room.current_round_id)
          .single();

        if (roundData) {
          setRoundState(roundData);

          // Lấy tất cả đặt cược của ván này
          const { data: betsData } = await supabase
            .from('bets')
            .select('*')
            .eq('round_id', roundData.id);
            
          if (betsData) setBets(betsData);
        }
      }

      // Lấy lịch sử chat (tối ưu hóa JOIN tránh N+1 gây treo/chậm phòng)
      const { data: chatsData, error: chatErr } = await supabase
        .from('chat_messages')
        .select(`
          id,
          room_id,
          user_id,
          message,
          created_at,
          users (
            username
          )
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(30);

      if (!chatErr && chatsData) {
        const formattedChats = (chatsData as any[]).map((c) => ({
          id: c.id,
          room_id: c.room_id,
          user_id: c.user_id,
          message: c.message,
          created_at: c.created_at,
          username: c.users?.username || 'Vô danh'
        }));
        setChatMessages(formattedChats);
      } else {
        // Fallback: Nếu join bị lỗi do phân quyền/schema, lấy thô và dùng 1 query IN duy nhất
        const { data: rawChats } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: true })
          .limit(30);
          
        if (rawChats) {
          const userIds = Array.from(new Set(rawChats.map(c => c.user_id)));
          const { data: usersList } = await supabase
            .from('users')
            .select('id, username')
            .in('id', userIds);
            
          const userMap = new Map((usersList || []).map(u => [u.id, u.username]));
          const formattedChats = rawChats.map(c => ({
            ...c,
            username: userMap.get(c.user_id) || 'Vô danh'
          }));
          setChatMessages(formattedChats);
        }
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Lỗi khi nạp thông tin phòng:', err);
      alert('Không thể vào phòng cược này hoặc phòng chơi đã bị đóng.');
      navigate('/lobby');
    }
  };

  useEffect(() => {
    // Nếu có timer dọn dẹp cũ đang chạy (do Strict Mode remount nhanh), hủy bỏ nó để giữ lại phòng
    if (globalCleanupTimer) {
      console.log('[GameRoomPage] Phát hiện Strict Mode remount nhanh, hủy bỏ việc rời phòng cũ.');
      clearTimeout(globalCleanupTimer);
      globalCleanupTimer = null;
    }
    
    // Luôn nạp thông tin phòng chơi khi component mount thực tế
    loadRoom();

    return () => {
      // Khi component unmount, lên lịch rời phòng sau 1 giây.
      // Nếu là unmount thật sự (chuyển trang), timer sẽ chạy và rời phòng.
      // Nếu là Strict Mode remount nhanh, timer sẽ bị hủy bỏ ở lần chạy tiếp theo.
      globalCleanupTimer = setTimeout(() => {
        if (roomId) {
          console.log('[GameRoomPage] Đang thực hiện rời phòng sau thời gian trì hoãn...');
          roomService.leaveRoom(roomId);
        }
        globalCleanupTimer = null;
      }, 1000);

      setActiveRoom(null);
      setPlayers([]);
      resetAnimationState();
    };
  }, [roomId]);

  // Kiểm tra host hiện tại
  const isHost = players.find(p => p.user_id === user?.id)?.is_host || false;

  const getStartRoundDebugContext = (action: 'start' | 'next') => ({
    action,
    roomId,
    hasActiveRoom: Boolean(activeRoom),
    activeRoom: activeRoom
      ? {
          id: activeRoom.id,
          status: activeRoom.status,
          current_round_id: activeRoom.current_round_id,
          bet_duration: activeRoom.bet_duration,
          created_by: activeRoom.created_by
        }
      : null,
    currentRound: currentRound
      ? {
          id: currentRound.id,
          phase: currentRound.phase,
          status: currentRound.status,
          phase_ends_at: currentRound.phase_ends_at
        }
      : null,
    userId: user?.id,
    isHost,
    playersCount: players.length,
    hostPlayer: players.find(p => p.user_id === user?.id) || null,
    startingRound,
    timestamp: new Date().toISOString()
  });

  useEffect(() => {
    console.log('[GameRoomPage.startRoundButtonState]', {
      roomId,
      isHost,
      phase: currentRound?.phase,
      roundStatus: currentRound?.status,
      playersCount: players.length,
      disabled: players.length < 1 || startingRound,
      visibleStartButton: Boolean(isHost && currentRound?.phase === 'waiting'),
      visibleNextButton: Boolean(isHost && currentRound?.status === 'finished')
    });
  }, [
    roomId,
    isHost,
    currentRound?.phase,
    currentRound?.status,
    players.length,
    startingRound
  ]);

  // Lắp máy trạng thái Game Loop (Chỉ Host điều khiển để chuyển tiếp phase tự động ở client nếu chưa bật server Edge Functions)
  const handleHostLoopTrigger = async () => {
    if (!currentRound || !activeRoom) return;

    try {
      if (currentRound.phase === 'betting') {
        // Chuyển betting -> lock cược (2 giây)
        await gameService.transitionPhase(currentRound.id, 'lock', 2);
      } else if (currentRound.phase === 'lock') {
        // Chuyển lock -> shake bát rung lắc (3 giây)
        await gameService.transitionPhase(currentRound.id, 'shake', 3);
      } else if (currentRound.phase === 'shake') {
        // Sinh xúc xắc và trả xu thưởng atomically bằng RPC
        await gameService.settleRound(currentRound.id);
      }
    } catch (err) {
      console.error('Lỗi khi Host trigger loop:', err);
    }
  };

  // Host bấm bắt đầu ván đấu mới khi ở trạng thái waiting
  const handleStartGame = async () => {
    console.log('[GameRoomPage.handleStartGame] click', getStartRoundDebugContext('start'));
    if (startingRound) {
      console.warn('[GameRoomPage.handleStartGame] ignored because a round is already starting');
      return;
    }
    if (!roomId || !activeRoom) {
      console.warn('[GameRoomPage.handleStartGame] missing required state', getStartRoundDebugContext('start'));
      return;
    }
    try {
      setStartingRound(true);
      const newRound = await gameService.startNewRound(roomId, activeRoom.bet_duration);
      console.log('[GameRoomPage.handleStartGame] success', {
        roundId: newRound.id,
        phase: newRound.phase,
        status: newRound.status
      });
      setRoundState(newRound);
      setActiveRoom({
        ...activeRoom,
        status: 'playing',
        current_round_id: newRound.id
      });
      clearLocalBets();
      setStartingRound(false);
    } catch (err: any) {
      console.error('[GameRoomPage.handleStartGame] failed', {
        context: getStartRoundDebugContext('start'),
        error: err
      });
      setStartingRound(false);
      alert('Lỗi khởi động ván mới: ' + err.message);
    }
  };

  // Host bấm chuyển ván mới tiếp theo sau khi đã xem kết quả
  const handleNextRound = async () => {
    console.log('[GameRoomPage.handleNextRound] click', getStartRoundDebugContext('next'));
    if (startingRound) {
      console.warn('[GameRoomPage.handleNextRound] ignored because a round is already starting');
      return;
    }
    if (!roomId || !activeRoom) {
      console.warn('[GameRoomPage.handleNextRound] missing required state', getStartRoundDebugContext('next'));
      return;
    }
    try {
      setStartingRound(true);
      const newRound = await gameService.startNewRound(roomId, activeRoom.bet_duration);
      console.log('[GameRoomPage.handleNextRound] success', {
        roundId: newRound.id,
        phase: newRound.phase,
        status: newRound.status
      });
      setRoundState(newRound);
      setActiveRoom({
        ...activeRoom,
        status: 'playing',
        current_round_id: newRound.id
      });
      clearLocalBets();
      setStartingRound(false);
    } catch (err: any) {
      console.error('[GameRoomPage.handleNextRound] failed', {
        context: getStartRoundDebugContext('next'),
        error: err
      });
      setStartingRound(false);
      alert('Lỗi tạo ván mới: ' + err.message);
    }
  };

  // Đặt cược cục bộ bằng chip đã chọn
  const handleBetClick = (animal: AnimalType) => {
    if (!currentRound || currentRound.phase !== 'betting') return;
    
    // Tính tổng số tiền đã đặt cược (gồm cược đã xác nhận + cược tạm)
    const totalLocalBet = Object.values(localBets).reduce((s, a) => s + a, 0);
    const myCurrentBets = bets
      .filter((b) => b.user_id === user?.id)
      .reduce((s, b) => s + Number(b.amount), 0);

    if (totalLocalBet + myCurrentBets + activeChip > (wallet?.balance || 0)) {
      alert('Số dư ví của bạn không đủ để đặt tiếp chip này!');
      return;
    }

    selectChipToBet(animal, activeChip);
  };

  // Xác nhận cược lên database
  const handleConfirmBets = async () => {
    if (!currentRound || currentRound.phase !== 'betting') return;
    try {
      setConfirming(true);
      await confirmLocalBets(async (animal, amount) => {
        await gameService.placeBet(currentRound.id, animal, amount);
      });
    } catch (err: any) {
      alert('Lỗi đặt cược: ' + err.message);
    } finally {
      setConfirming(false);
    }
  };

  const handleSendMessage = async (msg: string) => {
    if (!roomId) return;
    await gameService.sendChatMessage(roomId, msg);
  };

  if (loading || !activeRoom || !user || !wallet) {
    return <Loading fullPage />;
  }

  // Tổng tiền cược tạm thời
  const localBetSum = Object.values(localBets).reduce((a, b) => a + b, 0);
  const myConfirmedBetSum = bets
    .filter((b) => b.user_id === user.id)
    .reduce((s, b) => s + Number(b.amount), 0);

  return (
    <div className="flex-1 flex flex-col bg-slate-950">
      
      {/* Top Navigation Bar */}
      <div className="w-full bg-slate-900/60 border-b border-slate-900/80 px-4 py-3 flex items-center justify-between z-30 sticky top-0 backdrop-blur-md">
        <Button variant="ghost" onClick={() => navigate('/lobby')} className="p-2 gap-2 text-slate-300">
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Rời phòng</span>
        </Button>

        {/* Room Info */}
        <div className="flex flex-col items-center">
          <h3 className="text-sm font-bold text-slate-200 font-heading leading-none">
            {activeRoom.name}
          </h3>
          {activeRoom.code && (
            <span className="text-[10px] text-amber-400 font-extrabold tracking-widest mt-1 block">
              MÃ: {activeRoom.code}
            </span>
          )}
        </div>

        {/* Balance Status */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-slate-500 font-bold tracking-wider">VÍ CỦA BẠN</span>
          <span className="text-sm font-black text-amber-400">{formatCoin(wallet.balance)}</span>
        </div>
      </div>

      {/* Main Game Page Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6 p-4 md:p-6 overflow-hidden">
        
        {/* Left Column: Bàn cược & Xúc xắc (Chiếm 3 cột trên PC) */}
        <div className="lg:col-span-3 flex flex-col gap-6 overflow-y-auto scrollbar-none pb-24">
          
          {/* Dice shaker Area */}
          <div className="relative">
            {/* Vòng đếm ngược countdown to ở giữa */}
            {currentRound && currentRound.phase !== 'waiting' && currentRound.phase !== 'finished' && (
              <div className="absolute top-4 right-4 bg-slate-900 border border-slate-800 rounded-full w-12 h-12 flex items-center justify-center shadow-lg z-30">
                <span className={`text-base font-extrabold font-heading ${timeLeft <= 3 ? 'text-rose-500 animate-ping' : 'text-amber-400'}`}>
                  {timeLeft}s
                </span>
              </div>
            )}
            
            <DiceArea
              phase={currentRound?.phase || 'waiting'}
              diceResults={diceResults}
              isShaking={isShaking}
              isRevealing={isRevealing}
            />
          </div>

          {/* Host Controls Banner */}
          {isHost && currentRound?.phase === 'waiting' && (
            <div className="glass-panel p-5 rounded-2xl border border-dashed border-amber-500/30 flex flex-col sm:flex-row justify-between items-center gap-4 text-left">
              <div>
                <h4 className="text-sm font-extrabold text-amber-400 font-heading">BẠN LÀ CHỦ PHÒNG CƯỢC</h4>
                <p className="text-xs text-slate-400 mt-1">Đã có {players.length} người tham gia. Hãy bấm Bắt đầu để vào ván cược!</p>
              </div>
              <Button
                variant="gold"
                onClick={handleStartGame}
                disabled={players.length < 1 || startingRound}
                loading={startingRound}
              >
                Bắt đầu ván mới
              </Button>
            </div>
          )}

          {/* Host Next Round Trigger (khi đã reveal xong kết quả ván cược) */}
          {isHost && currentRound?.status === 'finished' && (
            <div className="glass-panel p-5 rounded-2xl border border-dashed border-emerald-500/30 flex justify-between items-center gap-4 text-left">
              <div>
                <h4 className="text-sm font-extrabold text-emerald-400 font-heading">VÁN ĐẤU ĐÃ KẾT THÚC</h4>
                <p className="text-xs text-slate-400 mt-1">Hệ thống đã trả xu thưởng thắng cược. Nhấp để qua ván mới!</p>
              </div>
              <Button
                variant="gold"
                onClick={handleNextRound}
                disabled={startingRound}
                loading={startingRound}
              >
                Tiếp tục ván mới
              </Button>
            </div>
          )}

          {/* Betting Board Grid */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
              <h3 className="text-base font-bold text-slate-300 font-heading tracking-wide">
                BÀN CƯỢC LỄ HỘI
              </h3>
              {currentRound?.phase === 'lock' && (
                <span className="text-xs font-bold text-rose-400 bg-rose-950/40 border border-rose-500/20 px-2 py-0.5 rounded-full">
                  ĐÃ KHÓA CƯỢC
                </span>
              )}
            </div>
            {currentRound && (
              <BettingBoard
                roundId={currentRound.id}
                phase={currentRound.phase}
                bets={bets}
                currentUserId={user.id}
                localBets={localBets}
                onBetClick={handleBetClick}
              />
            )}
          </div>

        </div>

        {/* Right Columns: Sidebar Chats & Players (PC display) */}
        <div className="hidden lg:flex flex-col gap-6 lg:col-span-1">
          <PlayerSidebar players={players} bets={bets} />
          <ChatBox messages={chatMessages} onSendMessage={handleSendMessage} />
        </div>

      </div>

      {/* Mobile Sticky Panel for Chips & Bet Controls */}
      {currentRound?.phase === 'betting' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 shadow-2xl p-3 flex flex-col gap-3 backdrop-blur-md">
          {/* Chip selections bar */}
          <div className="flex items-center gap-3 justify-center overflow-x-auto py-1 scrollbar-none">
            {BET_CHIPS.map((val) => (
              <BetChip
                key={val}
                amount={val}
                isSelected={activeChip === val}
                onClick={() => setActiveChip(val)}
              />
            ))}
          </div>

          {/* Action buttons (Clear / Confirm) */}
          <div className="flex gap-2.5 max-w-lg mx-auto w-full">
            <Button
              variant="ghost"
              onClick={clearLocalBets}
              disabled={localBetSum === 0 || confirming}
              className="flex-1"
            >
              Hủy cược
            </Button>
            <Button
              variant="gold"
              onClick={handleConfirmBets}
              disabled={localBetSum === 0 || confirming}
              loading={confirming}
              className="flex-2 text-sm"
            >
              Xác nhận cược ({localBetSum} xu)
            </Button>
          </div>
        </div>
      )}

      {/* Mobile tabs bar to switch views between Board, Chat and Players list */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-slate-950 border-t border-slate-900 flex items-center justify-around z-30">
        <button
          onClick={() => setMobileTab('board')}
          className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold tracking-wide uppercase flex-1 h-full ${
            mobileTab === 'board' ? 'text-amber-400' : 'text-slate-500'
          }`}
        >
          <Trophy size={18} />
          Bàn chơi
        </button>
        <button
          onClick={() => setMobileTab('players')}
          className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold tracking-wide uppercase flex-1 h-full relative ${
            mobileTab === 'players' ? 'text-amber-400' : 'text-slate-500'
          }`}
        >
          <Users size={18} />
          Người chơi
        </button>
        <button
          onClick={() => setMobileTab('chat')}
          className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold tracking-wide uppercase flex-1 h-full relative ${
            mobileTab === 'chat' ? 'text-amber-400' : 'text-slate-500'
          }`}
        >
          <MessageSquare size={18} />
          Trò chuyện
        </button>
      </div>

      {/* Floating Modal for Mobile Chat and Players panels */}
      {mobileTab === 'players' && (
        <div className="lg:hidden fixed inset-0 z-40 bg-slate-950/95 p-4 pt-16 flex flex-col animate-in slide-in-from-bottom duration-250">
          <Button variant="ghost" onClick={() => setMobileTab('board')} className="absolute top-4 right-4">
            Đóng
          </Button>
          <PlayerSidebar players={players} bets={bets} />
        </div>
      )}

      {mobileTab === 'chat' && (
        <div className="lg:hidden fixed inset-0 z-40 bg-slate-950/95 p-4 pt-16 flex flex-col animate-in slide-in-from-bottom duration-250">
          <Button variant="ghost" onClick={() => setMobileTab('board')} className="absolute top-4 right-4">
            Đóng
          </Button>
          <ChatBox messages={chatMessages} onSendMessage={handleSendMessage} />
        </div>
      )}

    </div>
  );
};
