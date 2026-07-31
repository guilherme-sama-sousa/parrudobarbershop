-- Parrudo Barbershop - estrutura inicial do Supabase/PostgreSQL
-- Execute este arquivo uma única vez no SQL Editor do Supabase.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.app_role as enum ('admin', 'staff');
create type public.appointment_status as enum ('scheduled', 'confirmed', 'completed', 'cancelled');
create type public.stock_movement_type as enum ('entry', 'exit');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Usuário',
  role public.app_role not null default 'staff',
  created_at timestamptz not null default now()
);

create table public.site_settings (
  id integer primary key default 1 check (id = 1),
  business_name text not null default 'Parrudo Barbershop',
  tagline text not null default 'Corte preciso. Barba alinhada. Presença de verdade.',
  whatsapp text,
  instagram text,
  address text,
  logo_url text,
  updated_at timestamptz not null default now()
);

create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialties text[] not null default '{}',
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_hours (
  day_of_week integer primary key check (day_of_week between 0 and 6),
  open_time time not null,
  close_time time not null,
  slot_minutes integer not null default 30 check (slot_minutes between 5 and 120),
  active boolean not null default true,
  check (close_time > open_time)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  barber_id uuid not null references public.barbers(id),
  service_id uuid not null references public.services(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status <> 'cancelled');

create table public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.blocked_times
  add constraint blocked_times_no_overlap
  exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  );

create table public.stock_products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  unit text not null default 'un',
  minimum_stock integer not null default 5 check (minimum_stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.stock_products(id) on delete cascade,
  movement_type public.stock_movement_type not null,
  quantity integer not null check (quantity > 0),
  reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create or replace function public.validate_blocked_time()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.appointments a
    where a.barber_id = new.barber_id
      and a.status <> 'cancelled'
      and a.starts_at < new.ends_at
      and a.ends_at > new.starts_at
  ) then
    raise exception 'Existe um agendamento ativo dentro deste período.';
  end if;

  new.created_by = coalesce(new.created_by, auth.uid());
  return new;
end;
$$;

create trigger validate_blocked_time_before_write
before insert or update on public.blocked_times
for each row execute function public.validate_blocked_time();

create or replace function public.validate_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current integer;
begin
  perform 1 from public.stock_products where id = new.product_id for update;

  select coalesce(sum(case when movement_type = 'entry' then quantity else -quantity end), 0)::integer
    into v_current
  from public.stock_movements
  where product_id = new.product_id;

  if new.movement_type = 'exit' and new.quantity > v_current then
    raise exception 'Saída maior que o estoque disponível (%).', v_current;
  end if;

  new.created_by = coalesce(new.created_by, auth.uid());
  return new;
end;
$$;

create trigger validate_stock_movement_before_insert
before insert on public.stock_movements
for each row execute function public.validate_stock_movement();

create view public.stock_balances
with (security_invoker = true)
as
select
  p.id,
  p.name,
  p.category,
  p.unit,
  p.minimum_stock,
  p.active,
  coalesce(sum(case when m.movement_type = 'entry' then m.quantity else -m.quantity end), 0)::integer as current_stock
from public.stock_products p
left join public.stock_movements m on m.product_id = p.id
group by p.id, p.name, p.category, p.unit, p.minimum_stock, p.active;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger site_settings_updated_at before update on public.site_settings for each row execute function public.set_updated_at();
create trigger barbers_updated_at before update on public.barbers for each row execute function public.set_updated_at();
create trigger services_updated_at before update on public.services for each row execute function public.set_updated_at();
create trigger clients_updated_at before update on public.clients for each row execute function public.set_updated_at();
create trigger appointments_updated_at before update on public.appointments for each row execute function public.set_updated_at();
create trigger stock_products_updated_at before update on public.stock_products for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.get_available_slots(
  p_date date,
  p_service_id uuid,
  p_barber_id uuid default null
)
returns table (
  slot_start timestamptz,
  barber_id uuid,
  barber_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with selected_service as (
    select duration_minutes
    from public.services
    where id = p_service_id and active = true
  ),
  selected_hours as (
    select open_time, close_time, slot_minutes
    from public.business_hours
    where day_of_week = extract(dow from p_date)::integer
      and active = true
  ),
  selected_barbers as (
    select id, name
    from public.barbers
    where active = true
      and (p_barber_id is null or id = p_barber_id)
  )
  select
    generated.slot_start,
    b.id as barber_id,
    b.name as barber_name
  from selected_service s
  cross join selected_hours h
  cross join selected_barbers b
  cross join lateral generate_series(
    ((p_date + h.open_time)::timestamp at time zone 'America/Bahia'),
    ((p_date + h.close_time)::timestamp at time zone 'America/Bahia') - make_interval(mins => s.duration_minutes),
    make_interval(mins => h.slot_minutes)
  ) as generated(slot_start)
  where generated.slot_start > now()
    and not exists (
      select 1
      from public.appointments a
      where a.barber_id = b.id
        and a.status <> 'cancelled'
        and a.starts_at < generated.slot_start + make_interval(mins => s.duration_minutes)
        and a.ends_at > generated.slot_start
    )
    and not exists (
      select 1
      from public.blocked_times bt
      where bt.barber_id = b.id
        and bt.starts_at < generated.slot_start + make_interval(mins => s.duration_minutes)
        and bt.ends_at > generated.slot_start
    )
  order by generated.slot_start, b.name;
$$;

create or replace function public.create_appointment(
  p_full_name text,
  p_phone text,
  p_service_id uuid,
  p_barber_id uuid,
  p_starts_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_client_id uuid;
  v_appointment_id uuid;
  v_duration integer;
  v_ends_at timestamptz;
begin
  if length(trim(p_full_name)) < 5 or position(' ' in trim(p_full_name)) = 0 then
    raise exception 'Informe nome e sobrenome.';
  end if;

  if p_phone !~ '^[0-9]{10,13}$' then
    raise exception 'Telefone inválido.';
  end if;

  select duration_minutes into v_duration
  from public.services
  where id = p_service_id and active = true;

  if v_duration is null then
    raise exception 'Serviço indisponível.';
  end if;

  if not exists (select 1 from public.barbers where id = p_barber_id and active = true) then
    raise exception 'Barbeiro indisponível.';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_duration);

  if not exists (
    select 1
    from public.get_available_slots(
      (p_starts_at at time zone 'America/Bahia')::date,
      p_service_id,
      p_barber_id
    ) available
    where available.slot_start = p_starts_at
      and available.barber_id = p_barber_id
  ) then
    raise exception 'Este horário não está mais disponível.';
  end if;

  insert into public.clients (full_name, phone)
  values (trim(p_full_name), p_phone)
  on conflict (phone) do update
    set full_name = excluded.full_name,
        updated_at = now()
  returning id into v_client_id;

  insert into public.appointments (
    client_id,
    barber_id,
    service_id,
    starts_at,
    ends_at
  ) values (
    v_client_id,
    p_barber_id,
    p_service_id,
    p_starts_at,
    v_ends_at
  ) returning id into v_appointment_id;

  return v_appointment_id;
exception
  when exclusion_violation then
    raise exception 'Este horário acabou de ser reservado. Escolha outro.';
end;
$$;

alter table public.profiles enable row level security;
alter table public.site_settings enable row level security;
alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.business_hours enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.blocked_times enable row level security;
alter table public.stock_products enable row level security;
alter table public.stock_movements enable row level security;

create policy "profile owner can read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "admins manage profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public reads settings" on public.site_settings for select to anon, authenticated using (true);
create policy "admins manage settings" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public reads active barbers" on public.barbers for select to anon, authenticated using (active = true or public.is_admin());
create policy "admins manage barbers" on public.barbers for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public reads active services" on public.services for select to anon, authenticated using (active = true or public.is_admin());
create policy "admins manage services" on public.services for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public reads business hours" on public.business_hours for select to anon, authenticated using (true);
create policy "admins manage business hours" on public.business_hours for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins manage clients" on public.clients for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage appointments" on public.appointments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage blocked times" on public.blocked_times for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage stock products" on public.stock_products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage stock movements" on public.stock_movements for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on function public.create_appointment(text, text, uuid, uuid, timestamptz) from public;
revoke all on function public.get_available_slots(date, uuid, uuid) from public;
grant execute on function public.create_appointment(text, text, uuid, uuid, timestamptz) to anon, authenticated;
grant execute on function public.get_available_slots(date, uuid, uuid) to anon, authenticated;
grant select on public.stock_balances to authenticated;

insert into public.site_settings (id, business_name, tagline)
values (1, 'Parrudo Barbershop', 'Corte preciso. Barba alinhada. Presença de verdade.')
on conflict (id) do nothing;

insert into public.business_hours (day_of_week, open_time, close_time, slot_minutes, active) values
  (0, '09:00', '18:00', 30, false),
  (1, '09:00', '19:00', 30, true),
  (2, '09:00', '19:00', 30, true),
  (3, '09:00', '19:00', 30, true),
  (4, '09:00', '19:00', 30, true),
  (5, '09:00', '19:00', 30, true),
  (6, '09:00', '18:00', 30, true)
on conflict (day_of_week) do nothing;

insert into public.services (name, description, price, duration_minutes) values
  ('Corte', 'Corte social, degradê ou navalhado.', 35.00, 30),
  ('Barba', 'Modelagem, acabamento e toalha quente.', 25.00, 30),
  ('Sobrancelha', 'Design e acabamento discreto.', 15.00, 15),
  ('Corte e Barba', 'Combo completo de corte e barba.', 55.00, 60),
  ('Corte e Sobrancelha', 'Corte com acabamento de sobrancelha.', 45.00, 45),
  ('Corte, Barba e Sobrancelha', 'Experiência completa Parrudo.', 70.00, 75);

insert into public.barbers (name, specialties)
values ('Barbeiro Principal', array['Corte', 'Barba']);

insert into public.stock_products (name, category, unit, minimum_stock) values
  ('Cerveja Heineken', 'Bebida', 'lata', 6),
  ('Água Mineral', 'Bebida', 'garrafa', 10),
  ('Refrigerante', 'Bebida', 'lata', 8)
on conflict (name) do nothing;
