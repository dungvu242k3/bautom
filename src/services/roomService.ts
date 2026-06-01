import { supabase } from './supabaseClient';
import { Room, RoomPlayer } from '@/types/game.types';

export const roomService = {
  // 1. Tạo phòng chơi mới
  async createRoom(
    name: string,
    isPrivate: boolean,
    maxPlayers: number,
    minBet: number,
    maxBet: number,
    betDuration: number = 15
  ): Promise<Room> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Chưa đăng nhập');

    // Tạo mã phòng 6 chữ số ngẫu nhiên nếu là phòng private
    let roomCode = null;
    if (isPrivate) {
      roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // 1. Insert phòng vào database
    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .insert({
        name,
        code: roomCode,
        is_private: isPrivate,
        max_players: maxPlayers,
        min_bet: minBet,
        max_bet: maxBet,
        bet_duration: betDuration,
        created_by: user.id,
        status: 'waiting'
      })
      .select()
      .single();

    if (roomErr) throw roomErr;

    // 2. Tự động thêm người tạo phòng làm Host
    const { error: playerErr } = await supabase
      .from('room_players')
      .insert({
        room_id: room.id,
        user_id: user.id,
        is_host: true,
        is_online: true
      });

    if (playerErr) throw playerErr;

    // 3. Tự động tạo ván chơi đầu tiên (Round 1 ở trạng thái waiting)
    const { data: round, error: roundErr } = await supabase
      .from('rounds')
      .insert({
        room_id: room.id,
        phase: 'waiting',
        status: 'active',
        phase_ends_at: new Date(Date.now() + 3600 * 1000).toISOString() // Đặt xa để chờ bắt đầu
      })
      .select()
      .single();

    if (roundErr) throw roundErr;

    // Cập nhật lại current_round_id trong bảng rooms
    await supabase
      .from('rooms')
      .update({ current_round_id: round.id })
      .eq('id', room.id);

    return { ...room, current_round_id: round.id } as Room;
  },

  // 2. Tham gia phòng chơi public/private bằng ID hoặc mã phòng
  async joinRoom(roomIdOrCode: string): Promise<Room> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Chưa đăng nhập');

    // Tìm phòng qua Code hoặc ID
    let query = supabase.from('rooms').select('*');
    if (roomIdOrCode.length === 6) {
      query = query.eq('code', roomIdOrCode.toUpperCase());
    } else {
      query = query.eq('id', roomIdOrCode);
    }

    const { data: room, error: roomFindErr } = await query.single();
    if (roomFindErr || !room) throw new Error('Không tìm thấy phòng chơi yêu cầu');

    // Đếm số người hiện tại trong phòng
    const { count, error: countErr } = await supabase
      .from('room_players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id);

    if (countErr) throw countErr;
    if (count && count >= room.max_players) {
      throw new Error('Phòng cược đã đầy người chơi');
    }

    // Insert người chơi mới vào phòng cược
    const { error: joinErr } = await supabase
      .from('room_players')
      .upsert({
        room_id: room.id,
        user_id: user.id,
        is_host: false,
        is_online: true
      }, { onConflict: 'room_id,user_id' });

    if (joinErr) throw joinErr;

    return room as Room;
  },

  // 3. Rời phòng chơi
  async leaveRoom(roomId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Rút người chơi khỏi phòng
    const { error: leaveErr } = await supabase
      .from('room_players')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', user.id);

    if (leaveErr) throw leaveErr;

    // 2. Nếu phòng không còn ai, ta xóa phòng để tránh rác DB
    const { count } = await supabase
      .from('room_players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId);

    if (count === 0) {
      await supabase.from('rooms').delete().eq('id', roomId);
    }
  },

  // 4. Lấy danh sách phòng chơi công khai
  async getPublicRooms(): Promise<Room[]> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_private', false)
      .eq('status', 'waiting')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Room[];
  },

  // 5. Lấy thông tin phòng và người chơi
  async getRoomDetails(roomId: string): Promise<{ room: Room; players: RoomPlayer[] }> {
    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomErr) throw roomErr;

    // Lấy thông tin người chơi kèm display_name từ profiles
    const { data: playersData, error: playersErr } = await supabase
      .from('room_players')
      .select(`
        id,
        room_id,
        user_id,
        is_host,
        is_online,
        joined_at,
        profiles!room_players_user_id_fkey(display_name, avatar_url),
        wallets!room_players_user_id_fkey(balance)
      `)
      .eq('room_id', roomId);

    if (playersErr) throw playersErr;

    // Format lại dữ liệu nhận được dạng dẹt dễ dùng
    const formattedPlayers = (playersData as any[]).map((p) => ({
      id: p.id,
      room_id: p.room_id,
      user_id: p.user_id,
      is_host: p.is_host,
      is_online: p.is_online,
      joined_at: p.joined_at,
      display_name: p.profiles?.display_name || 'Người chơi',
      avatar_url: p.profiles?.avatar_url || null,
      balance: p.wallets?.balance || 0
    }));

    return {
      room: room as Room,
      players: formattedPlayers
    };
  }
};
