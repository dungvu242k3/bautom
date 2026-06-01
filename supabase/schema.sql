-- Bầu Cua Arena - Supabase schema, RLS, realtime, and RPC backend.
-- Run this once in Supabase SQL Editor. Then enable Email auth with confirmations off.

create extension if not exists pgcrypto;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.create_room(text, boolean, int, bigint, bigint, int) cascade;
drop function if exists public.join_room(text) cascade;
drop function if exists public.leave_room(uuid) cascade;
drop function if exists public.start_round(uuid) cascade;
drop function if exists public.lock_round(uuid) cascade;
drop function if exists public.reveal_round(uuid) cascade;
drop function if exists public.place_bet(uuid, text, bigint) cascade;
drop function if exists public.is_room_member(uuid, uuid) cascade;
drop function if exists public.is_room_host(uuid, uuid) cascade;
drop function if exists public.ensure_profile_exists() cascade;
drop function if exists public.get_server_time() cascade;

drop table if exists public.chat_messages cascade;
drop table if exists public.coin_transactions cascade;
drop table if exists public.bets cascade;
drop table if exists public.rounds cascade;
drop table if exists public.room_players cascade;
drop table if exists public.rooms cascade;
drop table if exists public.wallets cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(display_name) between 2 and 32),
  total_win bigint not null default 0 check (total_win >= 0),
  total_loss bigint not null default 0 check (total_loss >= 0),
  win_streak int not null default 0 check (win_streak >= 0),
  max_win_streak int not null default 0 check (max_win_streak >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance bigint not null default 5000 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code ~ '^[A-Z0-9]{6}$'),
  name text not null check (char_length(name) between 3 and 48),
  is_private boolean not null default false,
  max_players int not null default 8 check (max_players between 2 and 16),
  min_bet bigint not null check (min_bet between 10 and 1000000),
  max_bet bigint not null check (max_bet between 10 and 1000000),
  bet_duration int not null check (bet_duration between 8 and 60),
  open_duration int not null default 3 check (open_duration = 3),
  status text not null default 'waiting' check (status in ('waiting', 'playing')),
  current_round_id uuid,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_bet_range check (min_bet <= max_bet)
);

create table public.room_players (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  phase text not null default 'waiting' check (phase in ('waiting', 'betting', 'opening', 'revealed', 'finished')),
  phase_started_at timestamptz not null default now(),
  phase_ends_at timestamptz not null default now(),
  dice text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  constraint dice_animals check (
    array_length(dice, 1) is null or (
      array_length(dice, 1) = 3 and
      dice <@ array['bau', 'cua', 'tom', 'ca', 'ga', 'nai']::text[]
    )
  )
);

alter table public.rooms
  add constraint rooms_current_round_fk
  foreign key (current_round_id) references public.rounds(id) on delete set null;

create table public.bets (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  animal text not null check (animal in ('bau', 'cua', 'tom', 'ca', 'ga', 'nai')),
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  round_id uuid references public.rounds(id) on delete set null,
  kind text not null check (kind in ('welcome_bonus', 'bet', 'win')),
  amount bigint not null,
  balance_before bigint not null,
  balance_after bigint not null,
  created_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 240),
  created_at timestamptz not null default now()
);

create index idx_rooms_status_created on public.rooms(status, created_at desc);
create index idx_room_players_user on public.room_players(user_id);
create index idx_rounds_room_created on public.rounds(room_id, created_at desc);
create index idx_bets_round_room on public.bets(round_id, room_id);
create index idx_bets_user_round on public.bets(user_id, round_id);
create index idx_chat_room_created on public.chat_messages(room_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger wallets_touch before update on public.wallets
for each row execute function public.touch_updated_at();

create trigger rooms_touch before update on public.rooms
for each row execute function public.touch_updated_at();

create or replace function public.is_room_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_players
    where room_id = p_room_id and user_id = p_user_id
  );
$$;

create or replace function public.is_room_host(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_players
    where room_id = p_room_id and user_id = p_user_id and is_host = true
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_display_name text;
begin
  v_username := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), '[^a-zA-Z0-9_]', '', 'g'));
  v_display_name := left(coalesce(new.raw_user_meta_data->>'display_name', v_username), 32);

  if char_length(v_username) < 3 then
    v_username := 'player_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, v_username, v_display_name);

  insert into public.wallets (user_id, balance)
  values (new.id, 5000);

  insert into public.coin_transactions (user_id, kind, amount, balance_before, balance_after)
  values (new.id, 'welcome_bonus', 5000, 0, 5000);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.rounds enable row level security;
alter table public.bets enable row level security;
alter table public.coin_transactions enable row level security;
alter table public.chat_messages enable row level security;

create policy "profiles are visible to authenticated players"
on public.profiles for select
to authenticated
using (true);

create policy "players can update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "players can read own wallet"
on public.wallets for select
to authenticated
using (auth.uid() = user_id);

create policy "players can read own transactions"
on public.coin_transactions for select
to authenticated
using (auth.uid() = user_id);

create policy "players can discover public rooms or joined rooms"
on public.rooms for select
to authenticated
using (
  is_private = false
  or created_by = auth.uid()
  or public.is_room_member(rooms.id, auth.uid())
);

create policy "room members can read player list"
on public.room_players for select
to authenticated
using (
  exists (
    select 1 from public.rooms r
    where r.id = room_players.room_id and (r.is_private = false or r.created_by = auth.uid())
  )
  or public.is_room_member(room_players.room_id, auth.uid())
);

create policy "room members can read rounds"
on public.rounds for select
to authenticated
using (public.is_room_member(rounds.room_id, auth.uid()));

create policy "room members can read bets"
on public.bets for select
to authenticated
using (public.is_room_member(bets.room_id, auth.uid()));

create policy "room members can read chat"
on public.chat_messages for select
to authenticated
using (public.is_room_member(chat_messages.room_id, auth.uid()));

create policy "room members can send chat"
on public.chat_messages for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.is_room_member(chat_messages.room_id, auth.uid())
);

create or replace function public.random_room_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i integer;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * 36)::integer + 1, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.create_room(
  p_name text,
  p_is_private boolean,
  p_max_players int,
  p_min_bet bigint,
  p_max_bet bigint,
  p_bet_duration int
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms;
  v_round public.rounds;
  v_code text;
begin
  if v_user_id is null then
    raise exception 'Bạn cần đăng nhập';
  end if;

  if p_min_bet > p_max_bet then
    raise exception 'Cược tối thiểu không được lớn hơn cược tối đa';
  end if;

  loop
    v_code := regexp_replace(public.random_room_code(), '[^A-Z0-9]', 'A', 'g');
    begin
      insert into public.rooms (code, name, is_private, max_players, min_bet, max_bet, bet_duration, created_by)
      values (v_code, trim(p_name), p_is_private, p_max_players, p_min_bet, p_max_bet, p_bet_duration, v_user_id)
      returning * into v_room;
      exit;
    exception when unique_violation then
    end;
  end loop;

  insert into public.room_players (room_id, user_id, is_host)
  values (v_room.id, v_user_id, true);

  insert into public.rounds (room_id, phase, phase_started_at, phase_ends_at)
  values (v_room.id, 'waiting', now(), now())
  returning * into v_round;

  update public.rooms
  set current_round_id = v_round.id
  where id = v_room.id
  returning * into v_room;

  return v_room;
end;
$$;

create or replace function public.join_room(p_code text)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms;
  v_count int;
begin
  if v_user_id is null then
    raise exception 'Bạn cần đăng nhập';
  end if;

  select * into v_room
  from public.rooms
  where code = upper(trim(p_code))
  for update;

  if not found then
    raise exception 'Không tìm thấy phòng';
  end if;

  select count(*) into v_count
  from public.room_players
  where room_id = v_room.id;

  if v_count >= v_room.max_players and not exists (
    select 1 from public.room_players where room_id = v_room.id and user_id = v_user_id
  ) then
    raise exception 'Phòng đã đầy';
  end if;

  insert into public.room_players (room_id, user_id, is_host)
  values (v_room.id, v_user_id, false)
  on conflict (room_id, user_id) do nothing;

  return v_room;
end;
$$;

create or replace function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_was_host boolean;
  v_next_host uuid;
begin
  if v_user_id is null then
    raise exception 'Bạn cần đăng nhập';
  end if;

  select is_host into v_was_host
  from public.room_players
  where room_id = p_room_id and user_id = v_user_id;

  delete from public.room_players
  where room_id = p_room_id and user_id = v_user_id;

  if v_was_host then
    select user_id into v_next_host
    from public.room_players
    where room_id = p_room_id
    order by joined_at asc
    limit 1;

    if v_next_host is not null then
      update public.room_players
      set is_host = true
      where room_id = p_room_id and user_id = v_next_host;
    end if;
  end if;
end;
$$;

create or replace function public.start_round(p_room_id uuid)
returns public.rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms;
  v_round public.rounds;
begin
  if v_user_id is null then
    raise exception 'Bạn cần đăng nhập';
  end if;

  select * into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found or not public.is_room_host(p_room_id, v_user_id) then
    raise exception 'Chỉ chủ phòng mới được bắt đầu ván';
  end if;

  if exists (
    select 1 from public.rounds
    where room_id = p_room_id and phase in ('betting', 'opening')
  ) then
    raise exception 'Đang có ván chưa kết thúc';
  end if;

  insert into public.rounds (room_id, phase, phase_started_at, phase_ends_at)
  values (p_room_id, 'betting', now(), now() + (v_room.bet_duration || ' seconds')::interval)
  returning * into v_round;

  update public.rooms
  set current_round_id = v_round.id, status = 'playing'
  where id = p_room_id;

  return v_round;
end;
$$;

create or replace function public.place_bet(p_round_id uuid, p_animal text, p_amount bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_round public.rounds;
  v_room public.rooms;
  v_balance bigint;
  v_after bigint;
begin
  if v_user_id is null then
    raise exception 'Bạn cần đăng nhập';
  end if;

  if p_animal not in ('bau', 'cua', 'tom', 'ca', 'ga', 'nai') then
    raise exception 'Lựa chọn không hợp lệ';
  end if;

  select * into v_round
  from public.rounds
  where id = p_round_id
  for update;

  if not found or v_round.phase <> 'betting' or now() > v_round.phase_ends_at then
    raise exception 'Đã hết thời gian đặt cược';
  end if;

  select * into v_room
  from public.rooms
  where id = v_round.room_id;

  if not exists (
    select 1 from public.room_players
    where room_id = v_round.room_id and user_id = v_user_id
  ) then
    raise exception 'Bạn chưa ở trong phòng này';
  end if;

  if p_amount < v_room.min_bet or p_amount > v_room.max_bet then
    raise exception 'Mức cược nằm ngoài giới hạn phòng';
  end if;

  select balance into v_balance
  from public.wallets
  where user_id = v_user_id
  for update;

  if v_balance < p_amount then
    raise exception 'Số dư không đủ';
  end if;

  v_after := v_balance - p_amount;

  update public.wallets
  set balance = v_after
  where user_id = v_user_id;

  insert into public.bets (round_id, room_id, user_id, animal, amount)
  values (p_round_id, v_round.room_id, v_user_id, p_animal, p_amount);

  insert into public.coin_transactions (user_id, round_id, kind, amount, balance_before, balance_after)
  values (v_user_id, p_round_id, 'bet', -p_amount, v_balance, v_after);

  return jsonb_build_object('balance', v_after);
end;
$$;

create or replace function public.lock_round(p_round_id uuid)
returns public.rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_round public.rounds;
  v_room public.rooms;
begin
  select * into v_round
  from public.rounds
  where id = p_round_id
  for update;

  if not found then
    raise exception 'Không tìm thấy ván';
  end if;

  if not public.is_room_host(v_round.room_id, v_user_id) then
    raise exception 'Chỉ chủ phòng mới được mở bát';
  end if;

  select * into v_room from public.rooms where id = v_round.room_id;

  if v_round.phase <> 'betting' then
    return v_round;
  end if;



  update public.rounds
  set phase = 'opening',
      phase_started_at = now(),
      phase_ends_at = now() + (v_room.open_duration || ' seconds')::interval
  where id = p_round_id
  returning * into v_round;

  return v_round;
end;
$$;

create or replace function public.reveal_round(p_round_id uuid)
returns public.rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_round public.rounds;
  v_dice text[];
  v_bet record;
  v_matches int;
  v_payout bigint;
  v_before bigint;
  v_after bigint;
begin
  select * into v_round
  from public.rounds
  where id = p_round_id
  for update;

  if not found then
    raise exception 'Không tìm thấy ván';
  end if;

  if not public.is_room_host(v_round.room_id, v_user_id) then
    raise exception 'Chỉ chủ phòng mới được công bố kết quả';
  end if;

  if v_round.phase = 'revealed' or v_round.phase = 'finished' then
    return v_round;
  end if;

  if v_round.phase <> 'opening' then
    raise exception 'Bát chưa ở trạng thái mở';
  end if;

  v_dice := array[
    (array['bau', 'cua', 'tom', 'ca', 'ga', 'nai'])[floor(random() * 6)::int + 1],
    (array['bau', 'cua', 'tom', 'ca', 'ga', 'nai'])[floor(random() * 6)::int + 1],
    (array['bau', 'cua', 'tom', 'ca', 'ga', 'nai'])[floor(random() * 6)::int + 1]
  ];

  for v_bet in
    select user_id, animal, amount
    from public.bets
    where round_id = p_round_id
  loop
    v_matches := 0;
    if v_dice[1] = v_bet.animal then v_matches := v_matches + 1; end if;
    if v_dice[2] = v_bet.animal then v_matches := v_matches + 1; end if;
    if v_dice[3] = v_bet.animal then v_matches := v_matches + 1; end if;

    if v_matches > 0 then
      v_payout := v_bet.amount + (v_bet.amount * v_matches);

      select balance into v_before
      from public.wallets
      where user_id = v_bet.user_id
      for update;

      v_after := v_before + v_payout;

      update public.wallets
      set balance = v_after
      where user_id = v_bet.user_id;

      insert into public.coin_transactions (user_id, round_id, kind, amount, balance_before, balance_after)
      values (v_bet.user_id, p_round_id, 'win', v_payout, v_before, v_after);

      update public.profiles
      set total_win = total_win + (v_payout - v_bet.amount),
          win_streak = win_streak + 1,
          max_win_streak = greatest(max_win_streak, win_streak + 1)
      where id = v_bet.user_id;
    else
      update public.profiles
      set total_loss = total_loss + v_bet.amount,
          win_streak = 0
      where id = v_bet.user_id;
    end if;
  end loop;

  update public.rounds
  set phase = 'revealed',
      dice = v_dice,
      phase_started_at = now(),
      phase_ends_at = now()
  where id = p_round_id
  returning * into v_round;

  update public.rooms
  set status = 'waiting'
  where id = v_round.room_id;

  return v_round;
end;
$$;

create or replace function public.ensure_profile_exists()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  u_id uuid := auth.uid();
  u_name text;
  disp_name text;
  r_profile public.profiles;
begin
  if u_id is null then
    raise exception 'Bạn cần đăng nhập';
  end if;

  select * into r_profile from public.profiles where id = u_id;

  if r_profile.id is null then
    select lower(regexp_replace(coalesce(raw_user_meta_data->>'username', split_part(email, '@', 1)), '[^a-zA-Z0-9_]', '', 'g'))
    into u_name
    from auth.users
    where id = u_id;

    if u_name is null or char_length(u_name) < 3 then
      u_name := concat('player_', substr(replace(u_id::text, '-', ''), 1, 8));
    end if;

    if exists (select 1 from public.profiles where username = u_name) then
      u_name := concat(u_name, '_', substr(replace(u_id::text, '-', ''), 1, 4));
    end if;

    select left(coalesce(raw_user_meta_data->>'display_name', u_name), 32)
    into disp_name
    from auth.users
    where id = u_id;

    insert into public.profiles (id, username, display_name)
    values (u_id, u_name, disp_name)
    returning * into r_profile;

    insert into public.wallets (user_id, balance)
    values (u_id, 5000)
    on conflict (user_id) do nothing;

    insert into public.coin_transactions (user_id, kind, amount, balance_before, balance_after)
    values (u_id, 'welcome_bonus', 5000, 0, 5000)
    on conflict do nothing;
  end if;

  return r_profile;
end;
$$;

create or replace function public.get_server_time()
returns timestamptz
language sql
stable
security definer
as $$
  select now();
$$;

grant execute on function public.create_room(text, boolean, int, bigint, bigint, int) to authenticated;
grant execute on function public.join_room(text) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;
grant execute on function public.start_round(uuid) to authenticated;
grant execute on function public.lock_round(uuid) to authenticated;
grant execute on function public.reveal_round(uuid) to authenticated;
grant execute on function public.place_bet(uuid, text, bigint) to authenticated;
grant execute on function public.is_room_member(uuid, uuid) to authenticated;
grant execute on function public.is_room_host(uuid, uuid) to authenticated;
grant execute on function public.ensure_profile_exists() to authenticated;
grant execute on function public.get_server_time() to public;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms') then
      alter publication supabase_realtime add table public.rooms;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_players') then
      alter publication supabase_realtime add table public.room_players;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rounds') then
      alter publication supabase_realtime add table public.rounds;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bets') then
      alter publication supabase_realtime add table public.bets;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages') then
      alter publication supabase_realtime add table public.chat_messages;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wallets') then
      alter publication supabase_realtime add table public.wallets;
    end if;
  end if;
end;
$$;
