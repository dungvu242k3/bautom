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
