-- Parrudo Barbershop - plano mensal vinculado aos assinantes
-- Execute este arquivo depois das migracoes 001, 002, 003 e 004.

alter table public.subscribers
  add column if not exists plan_id uuid references public.plans(id) on delete restrict;

create index if not exists subscribers_plan_id_idx
  on public.subscribers(plan_id);

comment on column public.subscribers.plan_id is
  'Plano mensal atualmente contratado pelo assinante.';

-- O campo permanece nulo apenas para cadastros criados antes desta migracao.
-- Novos cadastros exigem o plano no painel administrativo. Assim, o sistema
-- nao escolhe automaticamente um plano incorreto para assinantes existentes.
