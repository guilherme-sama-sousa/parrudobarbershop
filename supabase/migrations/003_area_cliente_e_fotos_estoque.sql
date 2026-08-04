-- Parrudo Barbershop - area autenticada do cliente e fotos do estoque
-- Execute este arquivo depois das migracoes 001 e 002.

alter table public.clients
  add column if not exists user_id uuid unique references auth.users(id) on delete set null,
  add column if not exists email text;

alter table public.stock_products
  add column if not exists photo_url text;

create index if not exists clients_user_id_idx on public.clients(user_id);
create index if not exists appointments_client_starts_idx on public.appointments(client_id, starts_at desc);

-- Mantem o perfil administrativo existente e vincula novos logins de clientes
-- pelo telefone, inclusive quando o cliente ja tinha um agendamento antigo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text;
  v_name text;
begin
  v_name := trim(coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));

  insert into public.profiles (id, full_name)
  values (new.id, v_name);

  if new.raw_user_meta_data ->> 'account_type' = 'client' then
    v_phone := regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g');

    if length(v_name) < 5 or position(' ' in v_name) = 0 then
      raise exception 'Informe nome e sobrenome.';
    end if;

    if v_phone !~ '^[0-9]{10,13}$' then
      raise exception 'Telefone inválido.';
    end if;

    update public.clients
       set user_id = new.id,
           full_name = v_name,
           email = lower(new.email),
           updated_at = now()
     where phone = v_phone
       and user_id is null;

    if not found then
      insert into public.clients (user_id, full_name, phone, email)
      values (new.id, v_name, v_phone, lower(new.email));
    end if;
  end if;

  return new;
end;
$$;

drop view if exists public.stock_balances;
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
  coalesce(sum(case when m.movement_type = 'entry' then m.quantity else -m.quantity end), 0)::integer as current_stock,
  p.photo_url
from public.stock_products p
left join public.stock_movements m on m.product_id = p.id
group by p.id, p.name, p.category, p.unit, p.minimum_stock, p.active, p.photo_url;

drop policy if exists "client reads own profile" on public.clients;
create policy "client reads own profile"
on public.clients for select to authenticated
using (user_id = auth.uid());

drop policy if exists "client updates own profile" on public.clients;
create policy "client updates own profile"
on public.clients for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "client reads own appointments" on public.appointments;
create policy "client reads own appointments"
on public.appointments for select to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.id = appointments.client_id
      and c.user_id = auth.uid()
  )
);

create or replace function public.create_client_appointment(
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
  if auth.uid() is null then
    raise exception 'Faça login para realizar o agendamento.';
  end if;

  select id into v_client_id
  from public.clients
  where user_id = auth.uid();

  if v_client_id is null then
    raise exception 'Cadastro de cliente não encontrado.';
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

create or replace function public.cancel_client_appointment(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.appointments a
     set status = 'cancelled',
         updated_at = now()
   where a.id = p_appointment_id
     and a.status in ('scheduled', 'confirmed')
     and a.starts_at > now()
     and exists (
       select 1
       from public.clients c
       where c.id = a.client_id
         and c.user_id = auth.uid()
     );

  if not found then
    raise exception 'Agendamento não encontrado ou não pode mais ser cancelado.';
  end if;
end;
$$;

revoke all on function public.create_appointment(text, text, uuid, uuid, timestamptz) from anon, authenticated;
revoke all on function public.create_client_appointment(uuid, uuid, timestamptz) from public;
revoke all on function public.cancel_client_appointment(uuid) from public;
grant execute on function public.create_client_appointment(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.cancel_client_appointment(uuid) to authenticated;
grant select on public.stock_balances to authenticated;

-- Bucket publico: apenas administradores enviam/removem; as imagens podem ser exibidas no painel.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public reads product images" on storage.objects;
create policy "public reads product images"
on storage.objects for select
using (bucket_id = 'product-images');

drop policy if exists "admins upload product images" on storage.objects;
create policy "admins upload product images"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admins update product images" on storage.objects;
create policy "admins update product images"
on storage.objects for update to authenticated
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admins delete product images" on storage.objects;
create policy "admins delete product images"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and public.is_admin());
