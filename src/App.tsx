import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import {
  CircleDollarSign,
  Copy,
  DoorOpen,
  Lock,
  LogIn,
  LogOut,
  MessageCircle,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  createRoom,
  fetchRoomState,
  fetchRooms,
  fetchWallet,
  getAuthBundle,
  joinRoom,
  leaveRoom,
  lockRound,
  login,
  logout,
  placeBet,
  register,
  revealRound,
  sendChat,
  startRound,
} from './api';
import { supabase } from './supabaseClient';
import { useCountdown } from './hooks';
import {
  ANIMALS,
  CHIP_VALUES,
  formatCoin,
  summarizeBets,
  validateBetAmount,
  validateRoomForm,
  validateUsername,
} from './gameRules';
import type { Animal, AuthState, Bet, ChatMessage, Room, RoomForm, RoomPlayer, Round } from './types';

type RoomState = {
  room: Room;
  players: RoomPlayer[];
  round: Round | null;
  bets: Bet[];
  messages: ChatMessage[];
};

const emptyAuth: AuthState = { user: null, profile: null, wallet: null };

const defaultRoomForm: RoomForm = {
  name: 'Sới bầu cua nhanh',
  isPrivate: false,
  maxPlayers: 8,
  minBet: 50,
  maxBet: 2500,
  betDuration: 15,
};

function App() {
  const [auth, setAuth] = useState<AuthState>(emptyAuth);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const refreshAuth = useCallback(async () => {
    const bundle = await getAuthBundle();
    setAuth(bundle);
  }, []);

  const refreshRooms = useCallback(async () => {
    if (!auth.user) return;
    setRooms(await fetchRooms());
  }, [auth.user]);

  const refreshRoom = useCallback(async () => {
    if (!activeRoomId) return;
    setRoomState(await fetchRoomState(activeRoomId));
    if (auth.user) setAuth((current) => ({ ...current, wallet: current.wallet }));
  }, [activeRoomId, auth.user]);

  const refreshWallet = useCallback(async () => {
    if (!auth.user) return;
    const wallet = await fetchWallet(auth.user.id);
    setAuth((current) => ({ ...current, wallet }));
  }, [auth.user]);

  useEffect(() => {
    refreshAuth().catch((error) => setNotice(error.message));
    const { data } = supabase.auth.onAuthStateChange(() => {
      refreshAuth().catch((error) => setNotice(error.message));
    });
    return () => data.subscription.unsubscribe();
  }, [refreshAuth]);

  useEffect(() => {
    if (!auth.user) return;
    refreshRooms().catch((error) => setNotice(error.message));
    const channel = supabase
      .channel('rooms-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        refreshRooms().catch((error) => setNotice(error.message));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auth.user, refreshRooms]);

  useEffect(() => {
    if (!activeRoomId || !auth.user) return;
    refreshRoom().catch((error) => setNotice(error.message));
    refreshWallet().catch((error) => setNotice(error.message));

    const channel = supabase
      .channel(`room-${activeRoomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${activeRoomId}` }, () => {
        refreshRoom().catch((error) => setNotice(error.message));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${activeRoomId}` }, () => {
        refreshRoom().catch((error) => setNotice(error.message));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `room_id=eq.${activeRoomId}` }, () => {
        refreshRoom().catch((error) => setNotice(error.message));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets', filter: `room_id=eq.${activeRoomId}` }, () => {
        refreshRoom().catch((error) => setNotice(error.message));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${activeRoomId}` }, () => {
        refreshRoom().catch((error) => setNotice(error.message));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${auth.user.id}` }, () => {
        refreshWallet().catch((error) => setNotice(error.message));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeRoomId, auth.user, refreshRoom, refreshWallet]);

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setNotice('');
    try {
      await action();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Có lỗi xảy ra');
    } finally {
      setBusy(false);
    }
  }

  if (!auth.user || !auth.profile) {
    return (
      <AuthScreen
        mode={authMode}
        busy={busy}
        notice={notice}
        onModeChange={setAuthMode}
        onSubmit={(username, displayName, password) =>
          runAction(async () => {
            if (authMode === 'register') {
              await register(username, displayName, password);
            } else {
              await login(username, password);
            }
            await refreshAuth();
          })
        }
      />
    );
  }

  return (
    <main className="app-shell">
      <Header auth={auth} busy={busy} onLogout={() => runAction(async () => logout())} />
      {notice ? <div className="notice">{notice}</div> : null}

      {activeRoomId && roomState ? (
        <GameRoom
          auth={auth}
          busy={busy}
          state={roomState}
          onBack={() => {
            setActiveRoomId(null);
            setRoomState(null);
            refreshRooms().catch((error) => setNotice(error.message));
          }}
          onLeave={() =>
            runAction(async () => {
              await leaveRoom(roomState.room.id);
              setActiveRoomId(null);
              setRoomState(null);
            })
          }
          onStart={() =>
            runAction(async () => {
              await startRound(roomState.room.id);
              await refreshRoom();
            })
          }
          onLock={(roundId) =>
            runAction(async () => {
              await lockRound(roundId);
              await refreshRoom();
            })
          }
          onReveal={(roundId) =>
            runAction(async () => {
              await revealRound(roundId);
              await refreshRoom();
              await refreshWallet();
            })
          }
          onBet={(animal, amount) =>
            runAction(async () => {
              await placeBet(roomState.round!.id, animal, amount);
              await Promise.all([refreshRoom(), refreshWallet()]);
            })
          }
          onChat={(body) =>
            runAction(async () => {
              await sendChat(roomState.room.id, auth.user!.id, body);
            })
          }
        />
      ) : (
        <Lobby
          rooms={rooms}
          busy={busy}
          onRefresh={() => refreshRooms().catch((error) => setNotice(error.message))}
          onCreate={(form) =>
            runAction(async () => {
              const validation = validateRoomForm(form);
              if (validation) throw new Error(validation);
              const room = await createRoom(form);
              setActiveRoomId(room.id);
            })
          }
          onJoin={(code) =>
            runAction(async () => {
              const room = await joinRoom(code);
              setActiveRoomId(room.id);
            })
          }
        />
      )}
    </main>
  );
}

function AuthScreen({
  mode,
  busy,
  notice,
  onModeChange,
  onSubmit,
}: {
  mode: 'login' | 'register';
  busy: boolean;
  notice: string;
  onModeChange: (mode: 'login' | 'register') => void;
  onSubmit: (username: string, displayName: string, password: string) => void;
}) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const usernameError = validateUsername(username);
    if (usernameError) {
      setLocalError(usernameError);
      return;
    }
    if (password.length < 6) {
      setLocalError('Mật khẩu cần ít nhất 6 ký tự');
      return;
    }
    if (mode === 'register' && displayName.trim().length < 2) {
      setLocalError('Tên hiển thị cần ít nhất 2 ký tự');
      return;
    }
    setLocalError('');
    onSubmit(username, displayName || username, password);
  }

  return (
    <main className="auth-layout">
      <section className="auth-hero">
        <div className="brand-mark">
          <Sparkles size={28} />
          <span>Bầu Cua Arena</span>
        </div>
        <h1>Vào phòng, đặt cửa, mở bát realtime.</h1>
        <p>Đăng nhập bằng tên người chơi, không cần Gmail. Supabase giữ ví, cược và kết quả ở server.</p>
      </section>

      <form className="auth-panel" onSubmit={submit}>
        <div className="segmented">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => onModeChange('login')}>
            Đăng nhập
          </button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => onModeChange('register')}>
            Đăng ký
          </button>
        </div>

        <label>
          Tên đăng nhập
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="vd: dungvu_01" />
        </label>

        {mode === 'register' ? (
          <label>
            Tên hiển thị
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="vd: Dũng Vũ" />
          </label>
        ) : null}

        <label>
          Mật khẩu
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tối thiểu 6 ký tự" />
        </label>

        {localError || notice ? <div className="form-error">{localError || notice}</div> : null}

        <button className="primary-action" disabled={busy} type="submit">
          <LogIn size={18} />
          {mode === 'login' ? 'Vào sảnh' : 'Tạo tài khoản'}
        </button>
      </form>
    </main>
  );
}

function Header({ auth, busy, onLogout }: { auth: AuthState; busy: boolean; onLogout: () => void }) {
  const [prevBalance, setPrevBalance] = useState<number | null>(null);
  const [delta, setDelta] = useState<number | null>(null);
  const [showDelta, setShowDelta] = useState(false);
  const currentBalance = auth.wallet?.balance ?? 0;

  useEffect(() => {
    if (prevBalance !== null && currentBalance !== prevBalance) {
      const diff = currentBalance - prevBalance;
      setDelta(diff);
      setShowDelta(true);
      const timer = setTimeout(() => setShowDelta(false), 2200);
      return () => clearTimeout(timer);
    }
    setPrevBalance(currentBalance);
  }, [currentBalance, prevBalance]);

  return (
    <header className="topbar">
      <div className="brand-mark compact">
        <Sparkles size={22} />
        <span>Bầu Cua Arena</span>
      </div>
      <div className="topbar-actions">
        <div className="wallet-container" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <div className="wallet-pill">
            <WalletCards size={17} />
            {formatCoin(currentBalance)} xu
          </div>
          {showDelta && delta !== null && (
            <span className={`balance-delta ${delta > 0 ? 'plus' : 'minus'}`}>
              {delta > 0 ? `+${formatCoin(delta)}` : formatCoin(delta)} xu
            </span>
          )}
        </div>
        <div className="user-pill">{auth.profile?.display_name}</div>
        <button className="icon-button" type="button" disabled={busy} onClick={onLogout} aria-label="Đăng xuất" title="Đăng xuất">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

function Lobby({
  rooms,
  busy,
  onRefresh,
  onCreate,
  onJoin,
}: {
  rooms: Room[];
  busy: boolean;
  onRefresh: () => void;
  onCreate: (form: RoomForm) => void;
  onJoin: (code: string) => void;
}) {
  const [form, setForm] = useState<RoomForm>(defaultRoomForm);
  const [joinCode, setJoinCode] = useState('');

  return (
    <section className="lobby-grid">
      <div className="tool-panel">
        <div className="panel-title">
          <Plus size={20} />
          Tạo phòng
        </div>
        <label>
          Tên phòng
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>
        <div className="two-col">
          <label>
            Cược từ
            <input type="number" value={form.minBet} onChange={(event) => setForm({ ...form, minBet: Number(event.target.value) })} />
          </label>
          <label>
            Đến
            <input type="number" value={form.maxBet} onChange={(event) => setForm({ ...form, maxBet: Number(event.target.value) })} />
          </label>
        </div>
        <div className="two-col">
          <label>
            Số người
            <input type="number" value={form.maxPlayers} onChange={(event) => setForm({ ...form, maxPlayers: Number(event.target.value) })} />
          </label>
          <label>
            Giây chọn
            <input type="number" value={form.betDuration} onChange={(event) => setForm({ ...form, betDuration: Number(event.target.value) })} />
          </label>
        </div>
        <label className="toggle-line">
          <input type="checkbox" checked={form.isPrivate} onChange={(event) => setForm({ ...form, isPrivate: event.target.checked })} />
          Phòng riêng bằng mã
        </label>
        <button className="primary-action" type="button" disabled={busy} onClick={() => onCreate(form)}>
          <Plus size={18} />
          Tạo và vào phòng
        </button>
      </div>

      <div className="rooms-section">
        <div className="section-head">
          <div>
            <h2>Sảnh đang mở</h2>
            <p>Chọn phòng công khai hoặc nhập mã phòng riêng.</p>
          </div>
          <button className="icon-button" type="button" onClick={onRefresh} disabled={busy} aria-label="Làm mới" title="Làm mới">
            <RefreshCw size={18} />
          </button>
        </div>

        <div className="join-row">
          <input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="Mã phòng" maxLength={6} />
          <button type="button" disabled={busy || joinCode.length < 3} onClick={() => onJoin(joinCode)}>
            <DoorOpen size={17} />
            Vào
          </button>
        </div>

        <div className="room-list">
          {rooms.map((room) => (
            <button className="room-card" type="button" key={room.id} onClick={() => onJoin(room.code)}>
              <span className="room-code">{room.code}</span>
              <strong>{room.name}</strong>
              <span>{formatCoin(room.min_bet)} - {formatCoin(room.max_bet)} xu</span>
              <span className="room-meta">
                <Users size={15} />
                Tối đa {room.max_players}
                {room.is_private ? <Lock size={15} /> : null}
              </span>
            </button>
          ))}
          {rooms.length === 0 ? <div className="empty-state">Chưa có phòng công khai nào.</div> : null}
        </div>
      </div>
    </section>
  );
}

function GameRoom({
  auth,
  busy,
  state,
  onBack,
  onLeave,
  onStart,
  onLock,
  onReveal,
  onBet,
  onChat,
}: {
  auth: AuthState;
  busy: boolean;
  state: RoomState;
  onBack: () => void;
  onLeave: () => void;
  onStart: () => void;
  onLock: (roundId: string) => void;
  onReveal: (roundId: string) => void;
  onBet: (animal: Animal, amount: number) => void;
  onChat: (body: string) => void;
}) {
  const [selectedChip, setSelectedChip] = useState(state.room.min_bet);
  const countdown = useCountdown(state.round?.phase_ends_at);
  const automationRef = useRef('');
  const isHost = state.players.some((player) => player.user_id === auth.user?.id && player.is_host);
  const totals = useMemo(() => summarizeBets(state.bets), [state.bets]);
  const myBets = useMemo(() => state.bets.filter((bet) => bet.user_id === auth.user?.id), [state.bets, auth.user?.id]);
  const round = state.round;

  const [prevPhase, setPrevPhase] = useState<string | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [modalData, setModalData] = useState<{
    dice: Animal[];
    netChange: number;
    totalPayout: number;
    totalBet: number;
  } | null>(null);

  const currentPhase = round?.phase ?? null;

  useEffect(() => {
    if (prevPhase !== null && currentPhase === 'revealed' && prevPhase !== 'revealed') {
      const userBets = state.bets.filter((bet) => bet.user_id === auth.user?.id);
      if (userBets.length > 0 && round?.dice && round.dice.length === 3) {
        const totalBet = userBets.reduce((sum, b) => sum + Number(b.amount), 0);
        const totalPayout = userBets.reduce((sum, b) => {
          const matches = round.dice.filter((d) => d === b.animal).length;
          const payout = matches === 0 ? 0 : Number(b.amount) + (Number(b.amount) * matches);
          return sum + payout;
        }, 0);
        const netChange = totalPayout - totalBet;

        setModalData({
          dice: round.dice as Animal[],
          netChange,
          totalPayout,
          totalBet,
        });
        setShowResultModal(true);
      }
    }
    setPrevPhase(currentPhase);
  }, [currentPhase, prevPhase, state.bets, auth.user?.id, round]);

  useEffect(() => {
    setSelectedChip((chip) => Math.min(Math.max(chip, state.room.min_bet), state.room.max_bet));
  }, [state.room.min_bet, state.room.max_bet]);

  useEffect(() => {
    if (!isHost || !round || countdown !== 0) return;
    const key = `${round.id}:${round.phase}`;
    if (automationRef.current === key) return;
    automationRef.current = key;

    if (round.phase === 'betting') onLock(round.id);
    if (round.phase === 'opening') onReveal(round.id);
  }, [countdown, isHost, onLock, onReveal, round]);

  const phaseText =
    round?.phase === 'betting'
      ? `Còn ${countdown}s để đặt cược`
      : round?.phase === 'opening'
        ? `Đang mở bát ${countdown}s`
        : round?.phase === 'revealed'
          ? 'Đã có kết quả'
          : 'Chờ chủ phòng bắt đầu';

  function submitBet(animal: Animal) {
    const error = validateBetAmount(selectedChip, state.room.min_bet, state.room.max_bet, auth.wallet?.balance ?? 0);
    if (error) {
      alert(error);
      return;
    }
    if (round?.phase !== 'betting') {
      alert('Chưa tới hoặc đã hết thời gian đặt cược');
      return;
    }
    onBet(animal, selectedChip);
  }

  return (
    <section className="game-layout">
      <div className="room-banner">
        <button className="ghost-button" type="button" onClick={onBack}>Sảnh</button>
        <div>
          <span className="room-code">{state.room.code}</span>
          <h2>{state.room.name}</h2>
          <p>{phaseText} · mở bát cố định 3s · cược {formatCoin(state.room.min_bet)} - {formatCoin(state.room.max_bet)} xu</p>
        </div>
        <div className="room-actions">
          <button className="icon-button" type="button" onClick={() => navigator.clipboard?.writeText(state.room.code)} title="Copy mã phòng" aria-label="Copy mã phòng">
            <Copy size={18} />
          </button>
          {isHost ? (
            <button className="primary-action small" type="button" disabled={busy || round?.phase === 'betting' || round?.phase === 'opening'} onClick={onStart}>
              <Play size={17} />
              Bắt đầu
            </button>
          ) : null}
          <button className="ghost-button danger" type="button" disabled={busy} onClick={onLeave}>Rời phòng</button>
        </div>
      </div>

      <div className="game-grid">
        <aside className="players-panel">
          <div className="panel-title">
            <Users size={20} />
            Người trong phòng
          </div>
          {state.players.map((player) => (
            <div className="player-row" key={player.user_id}>
              <span className="avatar">{(player.profiles?.display_name ?? 'P').slice(0, 1).toUpperCase()}</span>
              <span>{player.profiles?.display_name ?? player.profiles?.username ?? 'Người chơi'}</span>
              {player.is_host ? <ShieldCheck size={16} /> : null}
            </div>
          ))}
        </aside>

        <div className="board-panel">
          <div className="baucua-plate-wrapper">
            <div className="baucua-plate">
              {/* Three Dice Sitting inside the Plate */}
              <div className="plate-dice-container">
                {round?.phase === 'revealed' && round.dice.length === 3 ? (
                  round.dice.map((animal, index) => (
                    <ResultDie key={`${animal}-${index}`} animal={animal} />
                  ))
                ) : (
                  <div className="plate-empty-hint">
                    <CircleDollarSign size={32} className="pulse-dollar" />
                    <span>
                      {round?.phase === 'opening'
                        ? 'ĐANG LẮC BÁT...'
                        : round?.phase === 'betting'
                          ? 'ĐANG NHẬN CƯỢC...'
                          : 'ĐỢI BẮT ĐẦU VÁN'}
                    </span>
                  </div>
                )}
              </div>

              {/* Animated Bowl Dome Cover */}
              <div
                className={`baucua-bowl-cover ${
                  round?.phase === 'opening'
                    ? 'shaking'
                    : round?.phase === 'revealed'
                      ? 'lifted'
                      : round?.phase === 'betting'
                        ? 'closed'
                        : 'closed idle'
                }`}
              >
                <div className="bowl-inner">
                  <div className="bowl-knob" />
                  <div className="bowl-logo">
                    <Sparkles size={22} />
                  </div>
                  <span className="bowl-text">
                    {round?.phase === 'opening'
                      ? 'ĐANG LẮC BÁT...'
                      : round?.phase === 'betting'
                        ? 'BÁT ĐANG ÚP'
                        : 'ĐỢI VÁN MỚI'}
                  </span>
                </div>
              </div>
            </div>
          </div>

        <div className="chip-row">
          {CHIP_VALUES.filter((value) => value >= state.room.min_bet && value <= state.room.max_bet).map((chip) => (
            <button className={selectedChip === chip ? 'chip active' : 'chip'} type="button" key={chip} onClick={() => setSelectedChip(chip)}>
              {formatCoin(chip)}
            </button>
          ))}
          <input
            className="custom-chip"
            type="number"
            min={state.room.min_bet}
            max={state.room.max_bet}
            value={selectedChip}
            onChange={(event) => setSelectedChip(Number(event.target.value))}
          />
        </div>

        <div className="animal-grid">
          {ANIMALS.map((animal) => {
            const myAmount = myBets.filter((bet) => bet.animal === animal.id).reduce((sum, bet) => sum + bet.amount, 0);
            return (
              <button className="animal-tile" type="button" key={animal.id} disabled={busy || round?.phase !== 'betting'} onClick={() => submitBet(animal.id)}>
                <span className="animal-orb" style={{ '--tone': animal.tone } as CSSProperties}>
                  <AnimalVisual id={animal.id} />
                </span>
                <strong>{animal.label}</strong>
                <span>Tổng {formatCoin(totals[animal.id] ?? 0)}</span>
                <span>Bạn {formatCoin(myAmount)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <ChatPanel messages={state.messages} currentUserId={auth.user!.id} onChat={onChat} busy={busy} />

    </div>

      {showResultModal && modalData && createPortal(
        <div className="modal-overlay" onClick={() => setShowResultModal(false)}>
          <div className="result-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`modal-header ${modalData.netChange > 0 ? 'plus' : modalData.netChange < 0 ? 'minus' : 'neutral'}`}>
              <h3>
                {modalData.netChange > 0 ? '🎉 Thắng Lớn!' : modalData.netChange < 0 ? '💸 Rất Tiếc!' : '⚖️ Hòa Vốn!'}
              </h3>
              <p>Kết quả mở bát ván đấu</p>
            </div>
            
            <div className="modal-dice">
              {modalData.dice.map((animal, index) => (
                <ResultDie key={`${animal}-${index}`} animal={animal} />
              ))}
            </div>

            <div className="modal-recap">
              <div className="recap-row">
                <span>Tổng cược:</span>
                <span>{formatCoin(modalData.totalBet)} xu</span>
              </div>
              <div className="recap-row">
                <span>Nhận lại:</span>
                <span>{formatCoin(modalData.totalPayout)} xu</span>
              </div>
              <div className={`recap-row highlight ${modalData.netChange > 0 ? 'plus' : modalData.netChange < 0 ? 'minus' : ''}`}>
                <span>{modalData.netChange >= 0 ? 'Lợi nhuận:' : 'Thua lỗ:'}</span>
                <span className="value">
                  {modalData.netChange > 0 ? `+${formatCoin(modalData.netChange)}` : formatCoin(modalData.netChange)} xu
                </span>
              </div>
            </div>

            <button className="primary-action" type="button" onClick={() => setShowResultModal(false)}>
              Tiếp tục
            </button>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}

function AnimalVisual({ id, size = 32 }: { id: Animal; size?: number }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 64 64',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (id) {
    case 'bau':
      return (
        <svg {...props}>
          {/* Gourd outer body */}
          <path d="M32,12 C36,12 39,15 39,20 C39,24 37,27 34,29 C39,31 43,35 43,42 C43,51 38,54 32,54 C26,54 21,51 21,42 C21,35 25,31 30,29 C27,27 25,24 25,20 C25,15 28,12 32,12 Z" />
          {/* Sash at waist */}
          <path d="M26.5,29 C30,27.5 34,27.5 37.5,29" strokeWidth={2} />
          {/* Tied ribbon bows */}
          <path d="M32,28.5 C29.5,31 29,32.5 31.5,30.5" strokeWidth={2} />
          <path d="M32,28.5 C34.5,31 35,32.5 32.5,30.5" strokeWidth={2} />
          {/* Leaf on top stem */}
          <path d="M32,12 C34,8 37.5,7 39.5,8 C36,9.5 34.5,10 32,12" strokeWidth={2} />
        </svg>
      );
    case 'cua':
      return (
        <svg {...props}>
          {/* Oval main body */}
          <path d="M32,46 C41,46 47,41 47,35 C47,29 41,24 32,24 C23,24 17,29 17,35 C17,41 23,46 32,46 Z" />
          {/* Eye stalks */}
          <path d="M26,24 L25,18" />
          <circle cx="25" cy="18" r="2.5" fill="currentColor" />
          <path d="M38,24 L39,18" />
          <circle cx="39" cy="18" r="2.5" fill="currentColor" />
          {/* Left pincher and claw */}
          <path d="M17,33 C9,27 14,17 19,19" />
          <path d="M19,19 C15,14 22,14 20,19" fill="currentColor" />
          {/* Right pincher and claw */}
          <path d="M47,33 C55,27 50,17 45,19" />
          <path d="M45,19 C49,14 42,14 44,19" fill="currentColor" />
          {/* Legs */}
          <path d="M18,38 C11,40 13,46 15,48" />
          <path d="M20,42 C13,46 17,50 19,52" />
          <path d="M46,38 C53,40 51,46 49,48" />
          <path d="M44,42 C51,46 47,50 45,52" />
        </svg>
      );
    case 'tom':
      return (
        <svg {...props}>
          {/* Antennae */}
          <path d="M45,15 C52,9 56,11 58,16" strokeWidth={2} />
          <path d="M43,13 C48,6 53,6 55,10" strokeWidth={2} />
          {/* Head */}
          <path d="M38,15 C44,11 48,16 45,21 C42,23 38,20 38,15 Z" />
          {/* Eyes */}
          <circle cx="43" cy="16" r="1.5" fill="currentColor" />
          {/* Segmented body */}
          <path d="M41,20 C33,24 25,32 21,42 M41,20 C37,23 27,29 23,37" />
          {/* Segmentation lines */}
          <path d="M37,17 L34,22" />
          <path d="M32,21 L28,27" />
          <path d="M27,26 L23,33" />
          {/* Swimming legs */}
          <path d="M32,27 L30,31" />
          <path d="M27,32 L25,36" />
          <path d="M22,37 L20,41" />
          {/* Tail flappers */}
          <path d="M21,42 Q15,44 16,50 Q22,46 21,42" />
          <path d="M21,42 Q18,48 24,50 Q24,45 21,42" />
        </svg>
      );
    case 'ca':
      return (
        <svg {...props}>
          {/* Body */}
          <path d="M12,32 C20,18 42,18 52,32 C42,46 20,46 12,32 Z" />
          {/* Gills */}
          <path d="M36,25 C33,30 33,34 36,39" />
          {/* Eye */}
          <circle cx="44" cy="29" r="2.5" fill="currentColor" />
          {/* Tail */}
          <path d="M12,32 L4,22 L8,32 L4,42 Z" />
          {/* Dorsal Fin */}
          <path d="M30,20 C36,10 40,11 42,21" />
          {/* Pectoral Fin */}
          <path d="M30,44 C36,54 40,53 42,43" />
        </svg>
      );
    case 'ga':
      return (
        <svg {...props}>
          {/* Main round body */}
          <path d="M28,44 C38,44 43,39 43,32 C43,25 37,21 28,21 C19,21 14,25 14,32 C14,39 19,44 28,44 Z" />
          {/* Wing */}
          <path d="M24,32 C29,29 33,33 31,37 C27,41 22,37 24,32 Z" />
          {/* Head & Neck */}
          <path d="M36,24 C39,24 41,20 40,15 C35,15 32,21 31,23" />
          <circle cx="37" cy="18" r="1.5" fill="currentColor" />
          {/* Red Comb */}
          <path d="M38,15 C39,11 36,10 37,8 C34,9 33,11 35,13" stroke="#dc2626" />
          {/* Beak */}
          <path d="M40,16 L45,18 L40,20 Z" />
          {/* Tail feathers */}
          <path d="M15,29 C8,24 7,16 13,22" />
          <path d="M14,34 C7,35 6,26 12,30" />
          {/* Legs */}
          <path d="M23,43 L21,51" />
          <path d="M31,43 L33,51" />
          {/* Claws feet */}
          <path d="M21,51 L17,52" />
          <path d="M33,51 L37,52" />
        </svg>
      );
    case 'nai':
      return (
        <svg {...props}>
          {/* Stag head shield */}
          <path d="M32,48 C24,44 21,34 21,26 C21,20 43,20 43,26 C43,34 40,44 32,48 Z" />
          {/* Nose */}
          <polygon points="29,43 35,43 32,46" fill="currentColor" />
          {/* Eyes */}
          <circle cx="27" cy="30" r="2" fill="currentColor" />
          <circle cx="37" cy="30" r="2" fill="currentColor" />
          {/* Ears */}
          <path d="M22,23 C14,19 12,12 21,18 Z" />
          <path d="M42,23 C50,19 52,12 43,18 Z" />
          {/* Branching Antlers */}
          <path d="M26,20 Q16,8 18,2" />
          <path d="M21,11 Q12,12 16,16" />
          <path d="M24,6 Q26,3 30,5" />
          <path d="M38,20 Q48,8 46,2" />
          <path d="M43,11 Q52,12 48,16" />
          <path d="M40,6 Q38,3 34,5" />
        </svg>
      );
    default:
      return null;
  }
}

function ResultDie({ animal }: { animal: Animal }) {
  const item = ANIMALS.find((entry) => entry.id === animal)!;
  return (
    <div className="result-die" style={{ '--tone': item.tone } as CSSProperties}>
      <span>
        <AnimalVisual id={animal} size={30} />
      </span>
      <strong>{item.label}</strong>
    </div>
  );
}

function ChatPanel({
  messages,
  currentUserId,
  busy,
  onChat,
}: {
  messages: ChatMessage[];
  currentUserId: string;
  busy: boolean;
  onChat: (body: string) => void;
}) {
  const [text, setText] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    onChat(text);
    setText('');
  }

  return (
    <aside className="chat-panel">
      <div className="panel-title">
        <MessageCircle size={20} />
        Chat realtime
      </div>
      <div className="chat-list">
        {messages.map((message) => (
          <div className={message.user_id === currentUserId ? 'chat-message mine' : 'chat-message'} key={message.id}>
            <span>{message.profiles?.display_name ?? message.profiles?.username ?? 'Người chơi'}</span>
            <p>{message.body}</p>
          </div>
        ))}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input value={text} onChange={(event) => setText(event.target.value)} maxLength={240} placeholder="Nhắn trong phòng..." />
        <button className="icon-button solid" type="submit" disabled={busy || !text.trim()} aria-label="Gửi" title="Gửi">
          <Send size={17} />
        </button>
      </form>
    </aside>
  );
}

export default App;
