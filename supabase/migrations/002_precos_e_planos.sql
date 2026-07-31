-- Parrudo Barbershop - 002: tabela de preços real e planos mensais
-- Execute UMA vez no SQL Editor do Supabase (depois do 001, ou em banco já existente).

-- 1) Serviços com os preços oficiais da tabela.
--    Atualiza pelo nome se já existir; senão, cria. Desativa os que saíram da tabela.
do $$
declare
  item record;
begin
  for item in
    select * from (values
      ('Corte',                'Corte na máquina ou navalha.',            30.00, 30),
      ('Sobrancelha',          'Design e acabamento discreto.',           10.00, 15),
      ('Barba',                'Modelagem e acabamento.',                 15.00, 20),
      ('Pigmentação Frente',   'Pigmentação da parte da frente.',         10.00, 15),
      ('Pigmentação Completa', 'Pigmentação completa do cabelo.',         15.00, 20),
      ('Barba Pigmentada',     'Barba com pigmentação.',                  25.00, 30),
      ('Corte na Tesoura',     'Corte trabalhado inteiro na tesoura.',    50.00, 45),
      ('Luzes',                'Luzes com acabamento profissional.',      70.00, 90),
      ('Platinado',            'Descoloração global platinada.',         100.00, 120)
    ) as t(name, description, price, duration_minutes)
  loop
    update public.services
       set description = item.description,
           price = item.price,
           duration_minutes = item.duration_minutes,
           active = true
     where name = item.name;

    if not found then
      insert into public.services (name, description, price, duration_minutes, active)
      values (item.name, item.description, item.price, item.duration_minutes, true);
    end if;
  end loop;

  -- Desativa serviços antigos que não fazem parte da tabela oficial.
  update public.services
     set active = false
   where name not in (
     'Corte', 'Sobrancelha', 'Barba', 'Pigmentação Frente', 'Pigmentação Completa',
     'Barba Pigmentada', 'Corte na Tesoura', 'Luzes', 'Platinado'
   );
end $$;

-- 2) Planos mensais (pagamento até o 5º dia útil, contratação pelo WhatsApp).
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  price numeric(10,2) not null check (price >= 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists plans_updated_at on public.plans;
create trigger plans_updated_at before update on public.plans
for each row execute function public.set_updated_at();

alter table public.plans enable row level security;

drop policy if exists "public reads active plans" on public.plans;
create policy "public reads active plans" on public.plans
  for select to anon, authenticated using (active = true or public.is_admin());

drop policy if exists "admins manage plans" on public.plans;
create policy "admins manage plans" on public.plans
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.plans (name, description, price, sort_order) values
  ('Bronze',   'Corte (máquina/navalha)',                        104.99, 1),
  ('Prata',    'Corte + Pigmentação ou Sobrancelha',             114.99, 2),
  ('Ouro',     'Corte + Barba',                                  129.99, 3),
  ('Premium',  'Corte + Barba + Sobrancelha',                    154.99, 4),
  ('Diamante', 'Corte + Barba + Sobrancelha + Pigmentação',      179.99, 5)
on conflict (name) do update
  set description = excluded.description,
      price = excluded.price,
      sort_order = excluded.sort_order,
      active = true;
