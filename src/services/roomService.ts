import { supabase } from './supabaseClient';
import { Room, RoomPlayer } from '@/types/game.types';

export const roomService = {
  // 1. Tạo phòng chơi mới sử dụng Database RPC Transaction cực nhanh và an toàn
  async createRoom(
    name: string,
    isPrivate: boolean,
    maxPlayers: number,
    minBet: number,
    maxBet: number,
    betDuration: number = 15
  ): Promise<Room> {
    console.log('[roomService.createRoom] Khởi tạo phòng cược bằng RPC:', { name, isPrivate, maxPlayers, minBet, maxBet, betDuration });

    // Tạo mã phòng 6 chữ số ngẫu nhiên nếu là phòng private
    let roomCode = null;
    if (isPrivate) {
      roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    const { data, error } = await supabase.rpc('create_room_transaction', {
      p_name: name,
      p_is_private: isPrivate,
      p_max_players: maxPlayers,
      p_min_bet: minBet,
      p_max_bet: maxBet,
      p_bet_duration: betDuration,
      p_room_code: roomCode
    });

    if (error) {
      console.error('[roomService.createRoom] LỖI tạo phòng qua RPC:', error);
      throw error;
    }

    console.log('[roomService.createRoom] Tạo phòng qua RPC thành công:', data);
    return data as Room;
  },

  // 2. Tham gia phòng chơi public/private bằng ID hoặc mã phòng
  async joinRoom(roomIdOrCode: string): Promise<Room> {
    console.log('[roomService.joinRoom] Bắt đầu tham gia phòng:', roomIdOrCode);
    const { data: { user } } = await supabase.auth.getUser();
    console.log('[roomService.joinRoom] Bước 1 - Đã lấy user:', user?.id);
    if (!user) throw new Error('Chưa đăng nhập');

    // Tìm phòng qua Code hoặc ID
    console.log('[roomService.joinRoom] Bước 2 - Đang truy vấn phòng từ DB...');
    let query = supabase.from('rooms').select('*');
    if (roomIdOrCode.length === 6) {
      query = query.eq('code', roomIdOrCode.toUpperCase());
    } else {
      query = query.eq('id', roomIdOrCode);
    }

    const { data: room, error: roomFindErr } = await query.single();
    if (roomFindErr || !room) {
      console.error('[roomService.joinRoom] LỖI không tìm thấy phòng:', roomFindErr);
      throw new Error('Không tìm thấy phòng chơi yêu cầu');
    }
    console.log('[roomService.joinRoom] Đã tìm thấy phòng:', room);

    // Đếm số người hiện tại trong phòng
    console.log('[roomService.joinRoom] Bước 3 - Đang đếm số người chơi hiện tại...');
    const { count, error: countErr } = await supabase
      .from('room_players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id);

    if (countErr) {
      console.error('[roomService.joinRoom] LỖI đếm số người chơi:', countErr);
      throw countErr;
    }
    console.log('[roomService.joinRoom] Số người chơi hiện tại:', count);
    if (count && count >= room.max_players) {
      throw new Error('Phòng cược đã đầy người chơi');
    }

    // Insert người chơi mới vào phòng cược
    console.log('[roomService.joinRoom] Bước 4 - Đang đăng ký người chơi vào bảng room_players...');
    const { error: joinErr } = await supabase
      .from('room_players')
      .upsert({
        room_id: room.id,
        user_id: user.id,
        is_host: false,
        is_online: true
      }, { onConflict: 'room_id,user_id' });

    if (joinErr) {
      console.error('[roomService.joinRoom] LỖI đăng ký phòng chơi:', joinErr);
      throw joinErr;
    }
    console.log('[roomService.joinRoom] Đã tham gia phòng thành công!');

    return room as Room;
  },

  // 3. Rời phòng chơi
  async leaveRoom(roomId: string): Promise<void> {
    console.log('[roomService.leaveRoom] Đang rời phòng chơi:', roomId);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Rút người chơi khỏi phòng
    const { error: leaveErr } = await supabase
      .from('room_players')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', user.id);

    if (leaveErr) {
      console.error('[roomService.leaveRoom] LỖI khi rời phòng:', leaveErr);
      throw leaveErr;
    }
    console.log('[roomService.leaveRoom] Đã rút người chơi khỏi phòng!');

    // 2. Nếu phòng không còn ai, ta xóa phòng để tránh rác DB
    const { count } = await supabase
      .from('room_players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId);

    if (count === 0) {
      console.log('[roomService.leaveRoom] Phòng trống không còn ai, đang xóa phòng...');
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
    console.log('[roomService.getRoomDetails] Bắt đầu nạp thông tin chi tiết phòng:', roomId);
    
    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomErr) {
      console.error('[roomService.getRoomDetails] LỖI lấy rooms:', roomErr);
      throw roomErr;
    }
    console.log('[roomService.getRoomDetails] Lấy thông tin phòng thành công:', room);

    // Lấy danh sách người chơi thô trong phòng trước
    console.log('[roomService.getRoomDetails] Đang lấy danh sách người chơi room_players...');
    const { data: playersData, error: playersErr } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', roomId);

    if (playersErr) {
      console.error('[roomService.getRoomDetails] LỖI lấy room_players:', playersErr);
      throw playersErr;
    }
    console.log('[roomService.getRoomDetails] Đã lấy room_players:', playersData?.length, 'players');

    let formattedPlayers: RoomPlayer[] = [];

    if (playersData && playersData.length > 0) {
      const userIds = playersData.map((p) => p.user_id);

      // Lấy thông tin profiles song song cực nhanh bằng query IN để tránh N+1
      console.log('[roomService.getRoomDetails] Đang lấy profiles và wallets tương ứng...');
      const [profilesRes, walletsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', userIds),
        supabase.from('wallets').select('user_id, balance').in('user_id', userIds)
      ]);

      const profileMap = new Map((profilesRes.data || []).map((prof) => [prof.user_id, prof]));
      const walletMap = new Map((walletsRes.data || []).map((w) => [w.user_id, w.balance]));

      formattedPlayers = playersData.map((p) => {
        const profileObj = profileMap.get(p.user_id);
        const balanceVal = walletMap.get(p.user_id) || 0;

        return {
          id: p.id,
          room_id: p.room_id,
          user_id: p.user_id,
          is_host: p.is_host,
          is_online: p.is_online,
          joined_at: p.joined_at,
          display_name: profileObj?.display_name || 'Người chơi',
          avatar_url: profileObj?.avatar_url || null,
          balance: balanceVal
        };
      });
    }

    console.log('[roomService.getRoomDetails] Đã nạp thành công thông tin người chơi dẹt:', formattedPlayers);

    return {
      room: room as Room,
      players: formattedPlayers
    };
  }
};
