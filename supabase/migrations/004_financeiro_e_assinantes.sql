-- Parrudo Barbershop - fluxo de caixa e controle mensal de assinantes
-- Execute este arquivo depois das migracoes 001, 002 e 003.

create table if not exists public.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  movement_type text not null check (movement_type in ('entry', 'exit')),
  amount numeric(10,2) not null check (amount > 0),
  description text not null check (length(trim(description)) >= 2),
  barber_id uuid references public.barbers(id) on delete set null,
  occurred_on date not null default current_date,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) >= 3),
  phone text not null unique check (phone ~ '^[0-9]{10,13}$'),
  active boolean not null default true,
  started_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriber_payments (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  reference_month date not null,
  paid_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (subscriber_id, reference_month),
  check (reference_month = date_trunc('month', reference_month)::date)
);

create index if not exists cash_transactions_occurred_on_idx
  on public.cash_transactions(occurred_on desc);
create index if not exists cash_transactions_barber_month_idx
  on public.cash_transactions(barber_id, occurred_on desc);
create index if not exists subscriber_payments_reference_month_idx
  on public.subscriber_payments(reference_month desc, subscriber_id);

drop trigger if exists subscribers_updated_at on public.subscribers;
create trigger subscribers_updated_at
before update on public.subscribers
for each row execute function public.set_updated_at();

alter table public.cash_transactions enable row level security;
alter table public.subscribers enable row level security;
alter table public.subscriber_payments enable row level security;

drop policy if exists "admins manage cash transactions" on public.cash_transactions;
create policy "admins manage cash transactions"
on public.cash_transactions for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins manage subscribers" on public.subscribers;
create policy "admins manage subscribers"
on public.subscribers for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins manage subscriber payments" on public.subscriber_payments;
create policy "admins manage subscriber payments"
on public.subscriber_payments for all to authenticated
using (public.is_admin())
with check (public.is_admin());
