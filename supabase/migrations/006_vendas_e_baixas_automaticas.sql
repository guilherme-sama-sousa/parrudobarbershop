-- Parrudo Barbershop - vendas de produtos e baixas financeiras automaticas
-- Execute este arquivo depois das migracoes 001 a 005.

alter table public.stock_products
  add column if not exists sale_price numeric(10,2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stock_products_sale_price_check'
      and conrelid = 'public.stock_products'::regclass
  ) then
    alter table public.stock_products
      add constraint stock_products_sale_price_check check (sale_price >= 0);
  end if;
end $$;

alter table public.subscribers
  add column if not exists barber_id uuid references public.barbers(id) on delete set null;

alter table public.subscriber_payments
  add column if not exists cash_transaction_id uuid references public.cash_transactions(id) on delete restrict,
  add column if not exists amount numeric(10,2),
  add column if not exists barber_id uuid references public.barbers(id) on delete set null,
  add column if not exists plan_id uuid references public.plans(id) on delete set null;

create table if not exists public.product_sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.stock_products(id) on delete restrict,
  barber_id uuid not null references public.barbers(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price > 0),
  total_amount numeric(10,2) not null check (total_amount > 0),
  sold_on date not null default current_date,
  cash_transaction_id uuid not null unique references public.cash_transactions(id) on delete restrict,
  stock_movement_id uuid not null unique references public.stock_movements(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists subscribers_barber_id_idx on public.subscribers(barber_id);
create index if not exists subscriber_payments_cash_transaction_idx on public.subscriber_payments(cash_transaction_id);
create index if not exists product_sales_sold_on_idx on public.product_sales(sold_on desc, created_at desc);
create index if not exists product_sales_barber_month_idx on public.product_sales(barber_id, sold_on desc);

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
  p.sale_price,
  p.active,
  coalesce(sum(case when m.movement_type = 'entry' then m.quantity else -m.quantity end), 0)::integer as current_stock,
  p.photo_url
from public.stock_products p
left join public.stock_movements m on m.product_id = p.id
group by p.id, p.name, p.category, p.unit, p.minimum_stock, p.sale_price, p.active, p.photo_url;

alter table public.product_sales enable row level security;

drop policy if exists "admins manage product sales" on public.product_sales;
drop policy if exists "admins view product sales" on public.product_sales;
create policy "admins view product sales"
on public.product_sales for select to authenticated
using (public.is_admin());

create or replace function public.record_product_sale(
  p_product_id uuid,
  p_barber_id uuid,
  p_quantity integer,
  p_sold_on date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product_name text;
  v_unit_price numeric(10,2);
  v_product_active boolean;
  v_current_stock integer;
  v_total numeric(10,2);
  v_stock_movement_id uuid;
  v_cash_transaction_id uuid;
  v_sale_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem registrar vendas.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Informe uma quantidade maior que zero.';
  end if;

  if p_sold_on is null then
    raise exception 'Informe a data da venda.';
  end if;

  select name, sale_price, active
    into v_product_name, v_unit_price, v_product_active
  from public.stock_products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Produto não encontrado.';
  end if;

  if not v_product_active then
    raise exception 'Este produto está inativo.';
  end if;

  if v_unit_price <= 0 then
    raise exception 'Cadastre um preço de venda maior que zero para este produto.';
  end if;

  if not exists (select 1 from public.barbers where id = p_barber_id and active = true) then
    raise exception 'Selecione um barbeiro ativo para esta venda.';
  end if;

  select coalesce(sum(case when movement_type = 'entry' then quantity else -quantity end), 0)::integer
    into v_current_stock
  from public.stock_movements
  where product_id = p_product_id;

  if v_current_stock < p_quantity then
    raise exception 'Estoque insuficiente. Disponível: %.', v_current_stock;
  end if;

  v_total := round(v_unit_price * p_quantity, 2);

  insert into public.stock_movements (product_id, movement_type, quantity, reason, created_by)
  values (p_product_id, 'exit', p_quantity, 'Venda registrada pelo painel', auth.uid())
  returning id into v_stock_movement_id;

  insert into public.cash_transactions (
    movement_type, amount, description, barber_id, occurred_on, created_by
  ) values (
    'entry',
    v_total,
    format('Venda: %s x%s', v_product_name, p_quantity),
    p_barber_id,
    p_sold_on,
    auth.uid()
  ) returning id into v_cash_transaction_id;

  insert into public.product_sales (
    product_id, barber_id, quantity, unit_price, total_amount, sold_on,
    cash_transaction_id, stock_movement_id, created_by
  ) values (
    p_product_id, p_barber_id, p_quantity, v_unit_price, v_total, p_sold_on,
    v_cash_transaction_id, v_stock_movement_id, auth.uid()
  ) returning id into v_sale_id;

  return v_sale_id;
end;
$$;

create or replace function public.delete_product_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cash_transaction_id uuid;
  v_stock_movement_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem excluir vendas.';
  end if;

  select cash_transaction_id, stock_movement_id
    into v_cash_transaction_id, v_stock_movement_id
  from public.product_sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Venda não encontrada.';
  end if;

  delete from public.product_sales where id = p_sale_id;
  delete from public.cash_transactions where id = v_cash_transaction_id;
  delete from public.stock_movements where id = v_stock_movement_id;
end;
$$;

create or replace function public.mark_subscriber_payment(
  p_subscriber_id uuid,
  p_reference_month date,
  p_paid_on date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subscriber_name text;
  v_plan_id uuid;
  v_plan_name text;
  v_plan_price numeric(10,2);
  v_barber_id uuid;
  v_active boolean;
  v_started_on date;
  v_cash_transaction_id uuid;
  v_payment_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem dar baixa em mensalidades.';
  end if;

  if p_reference_month is null or p_reference_month <> date_trunc('month', p_reference_month)::date then
    raise exception 'Selecione um mês de referência válido.';
  end if;

  if p_paid_on is null then
    raise exception 'Informe a data do recebimento.';
  end if;

  select full_name, plan_id, barber_id, active, started_on
    into v_subscriber_name, v_plan_id, v_barber_id, v_active, v_started_on
  from public.subscribers
  where id = p_subscriber_id
  for update;

  if not found then
    raise exception 'Assinante não encontrado.';
  end if;

  if not v_active then
    raise exception 'Este assinante está inativo.';
  end if;

  if p_reference_month < date_trunc('month', v_started_on)::date then
    raise exception 'O mês selecionado é anterior ao início da assinatura.';
  end if;

  select name, price into v_plan_name, v_plan_price
  from public.plans
  where id = v_plan_id;

  if not found or v_plan_price <= 0 then
    raise exception 'Selecione um plano válido para o assinante.';
  end if;

  if not exists (select 1 from public.barbers where id = v_barber_id and active = true) then
    raise exception 'Selecione o barbeiro responsável pelo assinante.';
  end if;

  insert into public.cash_transactions (
    movement_type, amount, description, barber_id, occurred_on, created_by
  ) values (
    'entry',
    v_plan_price,
    format('Mensalidade %s - %s (%s)', to_char(p_reference_month, 'MM/YYYY'), v_subscriber_name, v_plan_name),
    v_barber_id,
    p_paid_on,
    auth.uid()
  ) returning id into v_cash_transaction_id;

  insert into public.subscriber_payments (
    subscriber_id, reference_month, paid_at, created_by,
    cash_transaction_id, amount, barber_id, plan_id
  ) values (
    p_subscriber_id, p_reference_month, now(), auth.uid(),
    v_cash_transaction_id, v_plan_price, v_barber_id, v_plan_id
  ) returning id into v_payment_id;

  return v_payment_id;
end;
$$;

create or replace function public.reopen_subscriber_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cash_transaction_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem reabrir mensalidades.';
  end if;

  select cash_transaction_id into v_cash_transaction_id
  from public.subscriber_payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Pagamento não encontrado.';
  end if;

  delete from public.subscriber_payments where id = p_payment_id;

  if v_cash_transaction_id is not null then
    delete from public.cash_transactions where id = v_cash_transaction_id;
  end if;
end;
$$;

revoke all on function public.record_product_sale(uuid, uuid, integer, date) from public;
revoke all on function public.delete_product_sale(uuid) from public;
revoke all on function public.mark_subscriber_payment(uuid, date, date) from public;
revoke all on function public.reopen_subscriber_payment(uuid) from public;

grant execute on function public.record_product_sale(uuid, uuid, integer, date) to authenticated;
grant execute on function public.delete_product_sale(uuid) to authenticated;
grant execute on function public.mark_subscriber_payment(uuid, date, date) to authenticated;
grant execute on function public.reopen_subscriber_payment(uuid) to authenticated;
grant select on public.stock_balances to authenticated;

comment on column public.stock_products.sale_price is
  'Preço unitário usado no lançamento automático da venda.';
comment on column public.subscribers.barber_id is
  'Barbeiro que recebe o faturamento das mensalidades deste assinante.';
comment on table public.product_sales is
  'Registro auditável que vincula cada venda à saída de estoque e à entrada no caixa.';
