-- BẦU CUA ONLINE MULTIPLAYER REALTIME DATABASE SCHEMA
-- Bấm nút "Run" trên SQL Editor của Supabase để triển khai toàn bộ database

-- =========================================================================
-- 1. DỌN DẸP TABLES CŨ NẾU CÓ
-- =========================================================================
drop table if exists public.chat_messages cascade;
drop table if exists public.coin_transactions cascade;
drop table if exists public.bets cascade;
drop table if exists public.rounds cascade;
drop table if exists public.room_players cascade;
drop table if exists public.rooms cascade;
drop table if exists public.wallets cascade;
drop table if exists public.profiles cascade;
drop table if exists public.users cascade;

-- =========================================================================
-- 2. TẠO BẢNG DỮ LIỆU CỐT LÕI
-- =========================================================================

-- A. Bảng Users (Mở rộng từ bảng auth.users của Supabase)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  username text unique not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- B. Bảng Profiles (Hồ sơ thống kê người chơi)
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.users(id) on delete cascade not null,
  display_name text not null,
  avatar_url text,
  total_win bigint not null default 0,
  total_loss bigint not null default 0,
  win_streak int not null default 0,
  max_win_streak int not null default 0,
  created_at timestamptz default now() not null
);

-- C. Bảng Wallets (Ví xu - Cấm Client trực tiếp UPDATE/INSERT)
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.users(id) on delete cascade not null,
  balance bigint not null default 1000,
  locked_balance bigint not null default 0,
  updated_at timestamptz default now() not null,
  constraint check_balance_non_negative check (balance >= 0),
  constraint check_locked_balance_non_negative check (locked_balance >= 0)
);

-- D. Bảng Rooms (Hệ thống phòng cược)
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code varchar(8) unique,
  is_private boolean default false not null,
  max_players int not null default 10,
  min_bet bigint not null default 50,
  max_bet bigint not null default 1000,
  bet_duration int not null default 15,
  status text not null default 'waiting' check (status in ('waiting', 'playing')),
  current_round_id uuid,
  created_by uuid references public.users(id),
  created_at timestamptz default now() not null
);

-- E. Bảng Room Players (Quản lý người chơi trong phòng)
create table public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  is_host boolean default false not null,
  is_online boolean default true not null,
  joined_at timestamptz default now() not null,
  unique(room_id, user_id)
);

-- F. Bảng Rounds (Vòng chơi / Trạng thái game loop)
create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade not null,
  phase text not null default 'waiting' check (phase in ('waiting', 'betting', 'lock', 'shake', 'reveal', 'settlement', 'finished')),
  status text not null default 'active' check (status in ('active', 'finished')),
  phase_started_at timestamptz default now() not null,
  phase_ends_at timestamptz not null,
  dice_1 text check (dice_1 in ('bau', 'cua', 'tom', 'ca', 'ga', 'nai')),
  dice_2 text check (dice_2 in ('bau', 'cua', 'tom', 'ca', 'ga', 'nai')),
  dice_3 text check (dice_3 in ('bau', 'cua', 'tom', 'ca', 'ga', 'nai')),
  created_at timestamptz default now() not null
);

-- G. Bảng Bets (Đặt cược của từng người chơi)
create table public.bets (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references public.rounds(id) on delete cascade not null,
  room_id uuid references public.rooms(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  animal text check (animal in ('bau', 'cua', 'tom', 'ca', 'ga', 'nai')) not null,
  amount bigint not null,
  created_at timestamptz default now() not null,
  constraint check_bet_amount_positive check (amount > 0)
);

-- H. Bảng Coin Transactions (Lịch sử giao dịch ví xu)
create table public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  round_id uuid references public.rounds(id),
  type text not null check (type in ('initial_bonus', 'place_bet', 'refund_bet', 'win_reward')),
  amount bigint not null, -- Số xu thay đổi (âm nếu trừ, dương nếu cộng)
  balance_before bigint not null,
  balance_after bigint not null,
  description text,
  created_at timestamptz default now() not null
);

-- I. Bảng Chat Messages (Trò chuyện trực tuyến phòng)
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  message text not null,
  created_at timestamptz default now() not null
);

-- =========================================================================
-- 3. THIẾT LẬP TRIGGER TỰ ĐỘNG ĐĂNG KÝ USER PROFILE & VÍ XU
-- =========================================================================

-- Trigger hàm tạo User Profile, Wallet & Transaction ban đầu khi có auth.users mới
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  v_username text;
begin
  -- Trích xuất username từ metadata hoặc dùng phần trước của email làm username mặc định
  v_username := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1)
  );

  -- Thêm vào bảng users mở rộng
  insert into public.users (id, email, username)
  values (new.id, new.email, v_username);

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

-- Đăng ký trigger trên auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================================
-- 4. KÍCH HOẠT ROW LEVEL SECURITY (RLS) & CHÍNH SÁCH BẢO MẬT (POLICIES)
-- =========================================================================

alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.rounds enable row level security;
alter table public.bets enable row level security;
alter table public.coin_transactions enable row level security;
alter table public.chat_messages enable row level security;

-- A. Chính sách Public Users/Profiles
create policy "Cho phép xem thông tin user công khai" on public.users
  for select using (true);

create policy "Cho phép cập nhật thông tin user chính mình" on public.users
  for update using (auth.uid() = id);

create policy "Cho phép xem profile công khai" on public.profiles
  for select using (true);

create policy "Cho phép cập nhật profile chính mình" on public.profiles
  for update using (auth.uid() = user_id);

-- B. Chính sách Ví Xu (Wallets) & Giao dịch (Coin Transactions) - CHỈ ĐỌC
create policy "Cho phép người dùng xem ví cá nhân" on public.wallets
  for select using (auth.uid() = user_id);

create policy "Cho phép người dùng xem lịch sử giao dịch cá nhân" on public.coin_transactions
  for select using (auth.uid() = user_id);

-- C. Chính sách Phòng Chơi (Rooms) & Người chơi trong phòng (Room Players)
create policy "Cho phép xem phòng chơi không ẩn" on public.rooms
  for select using (is_private = false or exists (
    select 1 from public.room_players where room_id = rooms.id and user_id = auth.uid()
  ));

create policy "Cho phép chủ phòng tạo phòng mới" on public.rooms
  for insert with check (auth.uid() = created_by);

create policy "Cho phép chủ phòng cập nhật cấu hình phòng" on public.rooms
  for update using (auth.uid() = created_by);

create policy "Cho phép xem người chơi cùng phòng" on public.room_players
  for select using (true);

create policy "Cho phép người dùng tự join hoặc rời phòng" on public.room_players
  for insert with check (auth.uid() = user_id);

create policy "Cho phép người dùng rời phòng" on public.room_players
  for delete using (auth.uid() = user_id);

-- D. Chính sách Vòng Chơi (Rounds) & Đặt Cược (Bets)
create policy "Cho phép xem vòng chơi trong phòng đang trực tuyến" on public.rounds
  for select using (true);

create policy "Cho phép người dùng xem cược của chính mình" on public.bets
  for select using (auth.uid() = user_id);

-- E. Chính sách Chat Room
create policy "Cho phép thành viên đọc tin nhắn chat phòng" on public.chat_messages
  for select using (
    exists (
      select 1 from public.room_players 
      where room_players.room_id = chat_messages.room_id 
      and room_players.user_id = auth.uid()
    )
  );

create policy "Cho phép thành viên gửi tin nhắn chat vào phòng" on public.chat_messages
  for insert with check (
    auth.uid() = user_id and
    exists (
      select 1 from public.room_players 
      where room_players.room_id = chat_messages.room_id 
      and room_players.user_id = auth.uid()
    )
  );

-- =========================================================================
-- 5. HÀM XỬ LÝ DATABASE RPC (REMOTE PROCEDURE CALLS - SERVER-SIDE ONLY)
-- =========================================================================

-- RPC 1: ĐẶT CƯỢC HỢP LỆ (BẢO MẬT & ATOMIC)
create or replace function public.place_bet(
  p_round_id uuid,
  p_animal text,
  p_amount bigint
)
returns json
language plpgsql
security definer -- Thực thi với đặc quyền admin để được cập nhật ví của user an toàn
as $$
declare
  v_user_id uuid;
  v_room_id uuid;
  v_current_phase text;
  v_balance bigint;
  v_min_bet bigint;
  v_max_bet bigint;
  v_new_balance bigint;
  v_phase_ends_at timestamptz;
begin
  -- 1. Xác thực tài khoản qua phiên Supabase token
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Người dùng chưa đăng nhập hệ thống';
  end if;

  -- 2. Kiểm tra phase ván cược
  select room_id, phase, phase_ends_at into v_room_id, v_current_phase, v_phase_ends_at 
  from public.rounds 
  where id = p_round_id;
  
  if not found then
    raise exception 'Không tìm thấy vòng cược hiện tại';
  end if;

  if v_current_phase != 'betting' then
    raise exception 'Đặt cược đã kết thúc hoặc vòng chơi chưa sẵn sàng';
  end if;

  -- Chống trễ mạng (Network Latency check): Nếu server đã quá giờ cược thì từ chối cược
  if now() > v_phase_ends_at then
    raise exception 'Quá thời gian cược quy định của phòng';
  end if;

  -- 3. Kiểm tra giới hạn cược tối thiểu và tối đa của phòng
  select min_bet, max_bet into v_min_bet, v_max_bet 
  from public.rooms 
  where id = v_room_id;
  
  if p_amount < v_min_bet or p_amount > v_max_bet then
    raise exception 'Số tiền cược phải nằm trong khoảng % xu đến % xu', v_min_bet, v_max_bet;
  end if;

  -- 4. Khóa dữ liệu ví để tránh Race Condition (FOR UPDATE)
  select balance into v_balance 
  from public.wallets 
  where user_id = v_user_id 
  for update;

  if v_balance < p_amount then
    raise exception 'Số xu hiện tại của bạn không đủ để đặt cược';
  end if;

  -- 5. Thực hiện trừ tiền ví người chơi atomically
  update public.wallets 
  set balance = balance - p_amount 
  where user_id = v_user_id;

  v_new_balance := v_balance - p_amount;

  -- 6. Ghi chép lịch sử biến động số dư giao dịch cược
  insert into public.coin_transactions (user_id, round_id, type, amount, balance_before, balance_after, description)
  values (
    v_user_id, 
    p_round_id, 
    'place_bet', 
    -p_amount, 
    v_balance, 
    v_new_balance, 
    'Đặt cược linh vật ' || p_animal || ' tại vòng cược'
  );

  -- 7. Thêm chi tiết cược mới
  insert into public.bets (round_id, room_id, user_id, animal, amount)
  values (p_round_id, v_room_id, v_user_id, p_animal, p_amount);

  return json_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'animal', p_animal,
    'amount', p_amount
  );
end;
$$;

-- RPC 2: TÍNH KẾT QUẢ VÁN & TRẢ THƯỞNG CHO NGƯỜI CHƠI (SERVER-SIDE TRIGGER)
create or replace function public.settle_round(p_round_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_room_id uuid;
  v_dice_options text[] := array['bau', 'cua', 'tom', 'ca', 'ga', 'nai'];
  v_d1 text;
  v_d2 text;
  v_d3 text;
  v_bet_record record;
  v_match_count int;
  v_win_amount bigint;
  v_balance_before bigint;
  v_balance_after bigint;
  v_settlement_count int := 0;
begin
  -- 1. Xác thực vòng chơi và trạng thái phase 'shake'
  select room_id into v_room_id from public.rounds where id = p_round_id and phase = 'shake';
  if not found then
    return json_build_object('success', false, 'message', 'Vòng chơi đã được tính điểm hoặc không ở phase rung lắc');
  end if;

  -- 2. Sinh kết quả ngẫu nhiên an toàn server-side
  v_d1 := v_dice_options[floor(random() * 6) + 1];
  v_d2 := v_dice_options[floor(random() * 6) + 1];
  v_d3 := v_dice_options[floor(random() * 6) + 1];

  -- Cập nhật kết quả xúc xắc của vòng chơi lên bảng rounds và chuyển sang phase 'reveal'
  update public.rounds 
  set dice_1 = v_d1, dice_2 = v_d2, dice_3 = v_d3, phase = 'reveal', phase_started_at = now()
  where id = p_round_id;

  -- 3. Quét toàn bộ đặt cược của vòng này để đối chiếu và trả xu
  for v_bet_record in 
    select id, user_id, animal, amount from public.bets where round_id = p_round_id
  loop
    -- Đếm số lần linh vật xuất hiện trong 3 viên xúc xắc
    v_match_count := 0;
    if v_d1 = v_bet_record.animal then v_match_count := v_match_count + 1; end if;
    if v_d2 = v_bet_record.animal then v_match_count := v_match_count + 1; end if;
    if v_d3 = v_bet_record.animal then v_match_count := v_match_count + 1; end if;

    if v_match_count > 0 then
      -- Thắng thưởng: nhận lại cược gốc + tiền lời tương ứng
      v_win_amount := v_bet_record.amount + (v_bet_record.amount * v_match_count);

      -- Khóa ví người chơi để tăng tiền an toàn
      select balance into v_balance_before from public.wallets where user_id = v_bet_record.user_id for update;
      
      update public.wallets 
      set balance = balance + v_win_amount 
      where user_id = v_bet_record.user_id;

      v_balance_after := v_balance_before + v_win_amount;

      -- Lưu log biến động số dư xu thắng thưởng
      insert into public.coin_transactions (user_id, round_id, type, amount, balance_before, balance_after, description)
      values (
        v_bet_record.user_id,
        p_round_id,
        'win_reward',
        v_win_amount,
        v_balance_before,
        v_balance_after,
        'Thắng cược linh vật ' || v_bet_record.animal || ' (xuất hiện ' || v_match_count || ' lần)'
      );

      -- Cập nhật tổng win và streak thắng trên profiles
      update public.profiles 
      set total_win = total_win + (v_win_amount - v_bet_record.amount),
          win_streak = win_streak + 1,
          max_win_streak = greatest(max_win_streak, win_streak + 1)
      where user_id = v_bet_record.user_id;
    else
      -- Thua cược: Đã trừ tiền từ khi đặt cược. Chỉ ghi nhận chỉ số thua trên profiles
      update public.profiles 
      set total_loss = total_loss + v_bet_record.amount,
          win_streak = 0
      where user_id = v_bet_record.user_id;
    end if;
    v_settlement_count := v_settlement_count + 1;
  end loop;

  -- Kết thúc vòng chơi hoàn hảo
  update public.rounds set status = 'finished' where id = p_round_id;

  return json_build_object(
    'success', true,
    'dice', array[v_d1, v_d2, v_d3],
    'settled_players', v_settlement_count
  );
end;
$$;

-- =========================================================================
-- 6. INDEXES ĐỂ TỐI ƯU TRUY VẤN
-- =========================================================================
create index if not exists idx_bets_round_id on public.bets(round_id);
create index if not exists idx_rounds_room_id on public.rounds(room_id);
create index if not exists idx_room_players_room_id on public.room_players(room_id);
create index if not exists idx_chat_messages_room_id on public.chat_messages(room_id);
create index if not exists idx_coin_transactions_user_id on public.coin_transactions(user_id);
