-- MIGRATION: ADMIN DASHBOARD & USER MANAGEMENT FUNCTIONS

-- 1. Kích hoạt extension pgcrypto để thực hiện băm và so khớp mật khẩu bằng bcrypt
create extension if not exists pgcrypto;

-- 2. Thêm cột role vào bảng public.users nếu chưa tồn tại
alter table public.users add column if not exists role text not null default 'user' check (role in ('user', 'admin'));

-- 3. Tạo hàm RPC lấy danh sách người chơi kèm dữ liệu thống kê và ví xu (Chỉ dành cho Admin)
create or replace function public.admin_get_users_list()
returns json
language plpgsql
security definer -- Chạy dưới quyền admin hệ thống để vượt qua giới hạn RLS
as $$
declare
  v_caller_role text;
begin
  -- Xác định vai trò của người gọi hàm
  select role into v_caller_role from public.users where id = auth.uid();
  if v_caller_role is null or v_caller_role != 'admin' then
    raise exception 'Quyền truy cập bị từ chối: Chỉ dành cho Admin';
  end if;

  return (
    select json_agg(
      json_build_object(
        'id', u.id,
        'email', u.email,
        'username', u.username,
        'status', u.status,
        'role', u.role,
        'created_at', u.created_at,
        'balance', coalesce(w.balance, 0),
        'total_win', coalesce(p.total_win, 0),
        'total_loss', coalesce(p.total_loss, 0),
        'win_streak', coalesce(p.win_streak, 0),
        'max_win_streak', coalesce(p.max_win_streak, 0)
      ) order by u.created_at desc
    )
    from public.users u
    left join public.wallets w on w.user_id = u.id
    left join public.profiles p on p.user_id = u.id
  );
end;
$$;

-- 4. Tạo hàm RPC cộng xu trực tiếp cho tài khoản người chơi (Chỉ dành cho Admin)
create or replace function public.admin_add_coins(
  p_user_id uuid,
  p_amount bigint,
  p_description text
)
returns json
language plpgsql
security definer
as $$
declare
  v_caller_role text;
  v_balance_before bigint;
  v_balance_after bigint;
begin
  -- Kiểm tra vai trò của người gọi
  select role into v_caller_role from public.users where id = auth.uid();
  if v_caller_role is null or v_caller_role != 'admin' then
    raise exception 'Quyền truy cập bị từ chối: Chỉ dành cho Admin';
  end if;

  if p_amount <= 0 then
    raise exception 'Số xu cộng thêm phải lớn hơn 0';
  end if;

  -- Khóa ví của người chơi được chỉ định để cập nhật an toàn
  select balance into v_balance_before from public.wallets where user_id = p_user_id for update;
  if not found then
    raise exception 'Không tìm thấy ví của người dùng này';
  end if;

  -- Cộng xu atomically
  update public.wallets 
  set balance = balance + p_amount 
  where user_id = p_user_id;

  v_balance_after := v_balance_before + p_amount;

  -- Lưu lịch sử biến động số dư dạng initial_bonus
  insert into public.coin_transactions (user_id, type, amount, balance_before, balance_after, description)
  values (
    p_user_id,
    'initial_bonus',
    p_amount,
    v_balance_before,
    v_balance_after,
    coalesce(p_description, 'Admin cộng xu hệ thống')
  );

  return json_build_object(
    'success', true,
    'new_balance', v_balance_after
  );
end;
$$;

-- 5. Tạo hàm RPC thay đổi mật khẩu người dùng khác (Chỉ dành cho Admin)
create or replace function public.admin_change_password(
  p_user_id uuid,
  p_new_password text
)
returns json
language plpgsql
security definer
as $$
declare
  v_caller_role text;
begin
  -- Kiểm tra vai trò của người gọi
  select role into v_caller_role from public.users where id = auth.uid();
  if v_caller_role is null or v_caller_role != 'admin' then
    raise exception 'Quyền truy cập bị từ chối: Chỉ dành cho Admin';
  end if;

  if length(p_new_password) < 6 then
    raise exception 'Mật khẩu mới phải có tối thiểu 6 ký tự';
  end if;

  -- Cập nhật mật khẩu trong auth.users bằng bcrypt
  update auth.users
  set encrypted_password = crypt(p_new_password, gen_salt('bf', 10))
  where id = p_user_id;

  if not found then
    raise exception 'Không tìm thấy người dùng này trong hệ thống';
  end if;

  return json_build_object(
    'success', true,
    'message', 'Đã thay đổi mật khẩu người dùng thành công'
  );
end;
$$;

-- 6. Tạo hàm RPC khóa/mở khóa trạng thái người dùng (Chỉ dành cho Admin)
create or replace function public.admin_toggle_user_status(
  p_user_id uuid,
  p_status text
)
returns json
language plpgsql
security definer
as $$
declare
  v_caller_role text;
begin
  -- Kiểm tra vai trò của người gọi
  select role into v_caller_role from public.users where id = auth.uid();
  if v_caller_role is null or v_caller_role != 'admin' then
    raise exception 'Quyền truy cập bị từ chối: Chỉ dành cho Admin';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Không thể tự khóa tài khoản quản trị của chính bạn';
  end if;

  if p_status not in ('active', 'suspended') then
    raise exception 'Trạng thái tài khoản không hợp lệ';
  end if;

  update public.users
  set status = p_status
  where id = p_user_id;

  return json_build_object(
    'success', true,
    'new_status', p_status
  );
end;
$$;

-- 7. Tạo hàm RPC xóa vĩnh viễn người dùng khỏi hệ thống (Chỉ dành cho Admin)
create or replace function public.admin_delete_user(
  p_user_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_caller_role text;
begin
  -- Kiểm tra vai trò của người gọi
  select role into v_caller_role from public.users where id = auth.uid();
  if v_caller_role is null or v_caller_role != 'admin' then
    raise exception 'Quyền truy cập bị từ chối: Chỉ dành cho Admin';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Không thể tự xóa tài khoản quản trị của chính bạn';
  end if;

  -- Xóa khỏi auth.users (cascade tự động xóa sạch bảng users, profiles, wallets...)
  delete from auth.users where id = p_user_id;

  return json_build_object(
    'success', true,
    'message', 'Đã xóa người chơi vĩnh viễn khỏi hệ thống'
  );
end;
$$;

-- 8. Tự động gán quyền 'admin' cho bất kỳ người dùng hiện tại nào có tên tài khoản là 'admin' hoặc 'dungvu'
update public.users 
set role = 'admin' 
where username = 'admin';

-- 9. Nâng cấp trigger handle_new_user để tự động gán quyền 'admin' khi tạo tài khoản mới nếu trùng tên 'admin' hoặc 'dungvu'
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  v_username text;
  v_role text := 'user';
begin
  -- Trích xuất username từ metadata hoặc dùng phần trước của email làm username mặc định
  v_username := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1)
  );

  -- Tự động gán làm admin nếu tên tài khoản là 'admin'
  if v_username = 'admin' then
    v_role := 'admin';
  end if;

  -- Thêm vào bảng users mở rộng
  insert into public.users (id, email, username, role)
  values (new.id, new.email, v_username, v_role);

  -- Thêm vào bảng profiles
  insert into public.profiles (user_id, display_name)
  values (new.id, v_username);

  -- Thêm vào bảng wallets mặc định 1000 xu
  insert into public.wallets (user_id, balance)
  values (new.id, 1000);

  -- Ghi nhận lịch sử tặng thưởng 1000 xu ban đầu
  insert into public.coin_transactions (user_id, type, amount, balance_before, balance_after, description)
  values (new.id, 'initial_bonus', 1000, 0, 1000, 'Tặng thưởng 1000 xu tân thủ khởi nghiệp');

  return new;
end;
$$;

-- =========================================================================
-- 10. SCRIPT THÊM TÀI KHOẢN ADMIN TRỰC TIẾP QUA SQL (CHẠY LỆNH NÀY)
-- =========================================================================
-- Bạn có thể chạy riêng khối lệnh bên dưới để tạo ngay tài khoản admin:
-- Tài khoản đăng nhập: admin
-- Mật khẩu đăng nhập: admin123 (Thay đổi nếu muốn)
do $$
declare
  v_admin_id uuid := gen_random_uuid();
  v_admin_email text := 'admin@bautom.com';
  v_admin_username text := 'admin';
  v_admin_password text := 'admin123';
  v_password_hash text;
begin
  -- Kích hoạt extension pgcrypto nếu chưa có
  create extension if not exists pgcrypto;

  -- Tạo mã hash bcrypt của mật khẩu với salt factor 10
  v_password_hash := crypt(v_admin_password, gen_salt('bf', 10));

  -- Kiểm tra xem tài khoản đã tồn tại chưa
  if not exists (select 1 from auth.users where email = v_admin_email) then
    
    -- Thêm tài khoản vào bảng auth.users của Supabase (Bổ sung các cột chuỗi rỗng bắt buộc của GoTrue)
    insert into auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      aud,
      role,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token,
      email_change_token_current,
      phone_change_token
    )
    values (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_admin_email,
      v_password_hash,
      now(),
      'authenticated',
      'authenticated',
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('username', v_admin_username, 'display_name', v_admin_username),
      false,
      now(),
      now(),
      '',
      '',
      '',
      '',
      '',
      ''
    );

    raise notice 'Tài khoản admin đã được khởi tạo thành công với mật khẩu: %', v_admin_password;
  else
    raise notice 'Tài khoản admin với email % đã tồn tại!', v_admin_email;
  end if;
end;
$$;

-- =========================================================================
-- 11. RPC ĐỂ TỐI ƯU HÓA QUÁ TRÌNH KHỞI TẠO PHÒNG CƯỢC MỚI (ATOMIC & HIGH-PERFORMANCE)
-- =========================================================================
-- Hướng dẫn: Chạy khối lệnh dưới đây trên SQL Editor của Supabase để khởi tạo hàm RPC.
-- Hàm này gộp 5 requests HTTP tuần tự của client thành 1 transaction duy nhất ở server-side.
create or replace function public.create_room_transaction(
  p_name text,
  p_is_private boolean,
  p_max_players int,
  p_min_bet bigint,
  p_max_bet bigint,
  p_bet_duration int,
  p_room_code text
)
returns json
language plpgsql
security definer -- Thực thi dưới quyền đặc quyền của hệ thống để vượt qua các RLS policy
as $$
declare
  v_user_id uuid;
  v_room record;
  v_round record;
begin
  -- 1. Xác thực tài khoản người dùng
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Người dùng chưa đăng nhập hệ thống';
  end if;

  -- 2. Thêm phòng chơi vào bảng rooms
  insert into public.rooms (
    name,
    code,
    is_private,
    max_players,
    min_bet,
    max_bet,
    bet_duration,
    created_by,
    status
  )
  values (
    p_name,
    p_room_code,
    p_is_private,
    p_max_players,
    p_min_bet,
    p_max_bet,
    p_bet_duration,
    v_user_id,
    'waiting'
  )
  returning * into v_room;

  -- 3. Đăng ký chủ phòng làm Host vào room_players
  insert into public.room_players (
    room_id,
    user_id,
    is_host,
    is_online
  )
  values (
    v_room.id,
    v_user_id,
    true,
    true
  );

  -- 4. Tạo ván đấu đầu tiên (rounds)
  insert into public.rounds (
    room_id,
    phase,
    status,
    phase_ends_at
  )
  values (
    v_room.id,
    'waiting',
    'active',
    now() + interval '1 hour'
  )
  returning * into v_round;

  -- 5. Liên kết current_round_id vào rooms
  update public.rooms
  set current_round_id = v_round.id
  where id = v_room.id;

  -- Trả về JSON khớp với cấu trúc Room của Client
  return json_build_object(
    'id', v_room.id,
    'name', v_room.name,
    'code', v_room.code,
    'is_private', v_room.is_private,
    'max_players', v_room.max_players,
    'min_bet', v_room.min_bet,
    'max_bet', v_room.max_bet,
    'bet_duration', v_room.bet_duration,
    'status', v_room.status,
    'created_by', v_room.created_by,
    'current_round_id', v_round.id,
    'created_at', to_char(v_room.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

-- =========================================================================
-- 12. HƯỚNG DẪN BẮT BUỘC: KÍCH HOẠT REALTIME CHO TOÀN BỘ BẢNG TRONG BẦU CUA ONLINE
-- =========================================================================
-- Chạy khối lệnh dưới đây trên SQL Editor của Supabase để bật đồng bộ Realtime.
-- Nếu không chạy khối lệnh này, các sự kiện đổi ván đấu, chat, đặt cược, ví sẽ KHÔNG đồng bộ về client.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

-- Thiết lập danh sách bảng tham gia Realtime (SET TABLE ghi đè an toàn, tránh lỗi trùng lặp)
alter publication supabase_realtime set table 
  public.rooms, 
  public.rounds, 
  public.room_players, 
  public.bets, 
  public.chat_messages, 
  public.wallets;

-- =========================================================================
-- 13. RPC ĐỂ BẮT ĐẦU VÁN ĐẤU MỚI (ATOMIC & HIGH-PERFORMANCE)
-- =========================================================================
-- Hướng dẫn: Chạy khối lệnh dưới đây trên SQL Editor của Supabase để tạo hàm start_new_round.
-- Hàm này giải quyết triệt để lỗi phân quyền (RLS) khi cập nhật phòng cược và tăng tốc độ chuyển ván.
create or replace function public.start_new_round(
  p_room_id uuid,
  p_bet_duration int
)
returns json
language plpgsql
security definer -- Khởi chạy dưới quyền hệ thống để vượt qua các RLS policy
as $$
declare
  v_user_id uuid;
  v_is_host boolean;
  v_new_round record;
  v_phase_ends_at timestamptz;
begin
  -- 1. Xác thực người dùng hiện tại
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Người dùng chưa đăng nhập hệ thống';
  end if;

  -- 2. Kiểm tra xem người dùng có phải là Host hoặc chủ phòng chơi không
  select is_host into v_is_host 
  from public.room_players 
  where room_id = p_room_id and user_id = v_user_id;

  if not found or v_is_host is not true then
    if not exists (select 1 from public.rooms where id = p_room_id and created_by = v_user_id) then
      raise exception 'Quyền truy cập bị từ chối: Chỉ có Host mới có thể bắt đầu ván mới';
    end if;
  end if;

  -- Tính thời gian kết thúc phase đặt cược mới
  v_phase_ends_at := now() + (p_bet_duration || ' seconds')::interval;

  -- 3. Tạo ván cược mới ở trạng thái 'betting'
  insert into public.rounds (
    room_id,
    phase,
    status,
    phase_started_at,
    phase_ends_at
  )
  values (
    p_room_id,
    'betting',
    'active',
    now(),
    v_phase_ends_at
  )
  returning * into v_new_round;

  -- 4. Cập nhật trạng thái và current_round_id trong bảng rooms
  update public.rooms
  set status = 'playing',
      current_round_id = v_new_round.id
  where id = p_room_id;

  -- Trả về JSON ván đấu mới khớp cấu trúc Client mong đợi
  return json_build_object(
    'id', v_new_round.id,
    'room_id', v_new_round.room_id,
    'phase', v_new_round.phase,
    'status', v_new_round.status,
    'phase_started_at', to_char(v_new_round.phase_started_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'phase_ends_at', to_char(v_new_round.phase_ends_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'created_at', to_char(v_new_round.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

-- =========================================================================
-- 14. MIGRATION: SỬA LỖI KHÔNG XÓA ĐƯỢC PHÒNG CHƠI DO RÀNG BUỘC KHÓA NGOẠI
-- =========================================================================
-- Hướng dẫn: Chạy khối lệnh dưới đây trên SQL Editor của Supabase.
-- Lệnh này đổi hành vi xóa của khóa ngoại coin_transactions_round_id_fkey sang ON DELETE SET NULL.
-- Việc này giúp khi phòng/ván chơi bị xóa (do không còn ai chơi), lịch sử giao dịch xu vẫn được giữ lại 
-- nhưng liên kết round_id được set về NULL, tránh gây lỗi khóa ngoại và treo dữ liệu.
alter table public.coin_transactions 
  drop constraint if exists coin_transactions_round_id_fkey;

alter table public.coin_transactions 
  add constraint coin_transactions_round_id_fkey 
  foreign key (round_id) 
  references public.rounds(id) 
  on delete set null;
