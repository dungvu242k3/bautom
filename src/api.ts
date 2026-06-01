import { supabase } from './supabaseClient';
import { authEmailFromUsername, normalizeUsername } from './gameRules';
import type { Animal, Bet, ChatMessage, Profile, Room, RoomForm, RoomPlayer, Round, Wallet } from './types';

function throwIfError<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export async function getAuthBundle() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user ?? null;

  if (!user) return { user: null, profile: null, wallet: null };

  let { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  let { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  // If authenticated but profile/wallet is missing, auto-create via the RPC
  if ((!profile || !wallet) && !profileError && !walletError) {
    try {
      await supabase.rpc('ensure_profile_exists');
      
      const [pRes, wRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle(),
      ]);
      
      profile = pRes.data;
      profileError = pRes.error;
      wallet = wRes.data;
      walletError = wRes.error;
    } catch (e) {
      console.error('Failed to auto-initialize profile and wallet:', e);
    }
  }

  return {
    user,
    profile: throwIfError<Profile>(profile, profileError),
    wallet: throwIfError<Wallet>(wallet, walletError),
  };
}

export async function register(username: string, displayName: string, password: string) {
  const cleanUsername = normalizeUsername(username);
  const { data, error } = await supabase.auth.signUp({
    email: authEmailFromUsername(cleanUsername),
    password,
    options: {
      data: {
        username: cleanUsername,
        display_name: displayName.trim(),
      },
    },
  });
  return throwIfError(data, error);
}

export async function login(username: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: authEmailFromUsername(username),
    password,
  });
  return throwIfError(data, error);
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function fetchRooms() {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(40);
  return throwIfError<Room[]>(data, error);
}

export async function createRoom(form: RoomForm) {
  const { data, error } = await supabase.rpc('create_room', {
    p_name: form.name.trim(),
    p_is_private: form.isPrivate,
    p_max_players: form.maxPlayers,
    p_min_bet: form.minBet,
    p_max_bet: form.maxBet,
    p_bet_duration: form.betDuration,
  });
  return throwIfError<Room>(data, error);
}

export async function joinRoom(code: string) {
  const { data, error } = await supabase.rpc('join_room', { p_code: code.trim().toUpperCase() });
  return throwIfError<Room>(data, error);
}

export async function leaveRoom(roomId: string) {
  const { error } = await supabase.rpc('leave_room', { p_room_id: roomId });
  if (error) throw error;
}

export async function fetchRoomState(roomId: string) {
  const [
    { data: room, error: roomError },
    { data: players, error: playersError },
    { data: rounds, error: roundsError },
    { data: bets, error: betsError },
    { data: messages, error: messagesError },
  ] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', roomId).maybeSingle(),
    supabase
      .from('room_players')
      .select('*, profiles:profiles(id, username, display_name, win_streak)')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true }),
    supabase.from('rounds').select('*').eq('room_id', roomId).order('created_at', { ascending: false }).limit(1),
    supabase.from('bets').select('*').eq('room_id', roomId).order('created_at', { ascending: false }).limit(300),
    supabase
      .from('chat_messages')
      .select('*, profiles:profiles(display_name, username)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(80),
  ]);

  const resolvedRoom = throwIfError<Room | null>(room, roomError);
  if (!resolvedRoom) {
    throw new Error('Phòng không tồn tại hoặc bạn không có quyền tham gia');
  }

  const resolvedRounds = throwIfError<Round[]>(rounds, roundsError);
  const currentRound = resolvedRounds[0] ?? null;
  const resolvedBets = throwIfError<Bet[]>(bets, betsError);

  // Only return bets for the current round to reset bets when starting a new round
  const currentRoundBets = currentRound
    ? resolvedBets.filter((b) => b.round_id === currentRound.id)
    : [];

  return {
    room: resolvedRoom,
    players: throwIfError<RoomPlayer[]>(players, playersError),
    round: currentRound,
    bets: currentRoundBets,
    messages: throwIfError<ChatMessage[]>(messages, messagesError).reverse(),
  };
}

export async function fetchWallet(userId: string) {
  const { data, error } = await supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle();
  const wallet = throwIfError<Wallet | null>(data, error);
  if (!wallet) {
    throw new Error('Ví của người chơi không tồn tại');
  }
  return wallet;
}

export async function startRound(roomId: string) {
  const { data, error } = await supabase.rpc('start_round', { p_room_id: roomId });
  return throwIfError<Round>(data, error);
}

export async function lockRound(roundId: string) {
  const { data, error } = await supabase.rpc('lock_round', { p_round_id: roundId });
  return throwIfError<Round>(data, error);
}

export async function revealRound(roundId: string) {
  const { data, error } = await supabase.rpc('reveal_round', { p_round_id: roundId });
  return throwIfError<Round>(data, error);
}

export async function placeBet(roundId: string, animal: Animal, amount: number) {
  const { data, error } = await supabase.rpc('place_bet', {
    p_round_id: roundId,
    p_animal: animal,
    p_amount: amount,
  });
  return throwIfError<{ balance: number }>(data, error);
}

export async function sendChat(roomId: string, userId: string, body: string) {
  const { error } = await supabase.from('chat_messages').insert({
    room_id: roomId,
    user_id: userId,
    body: body.trim(),
  });
  if (error) throw error;
}
