# Parrudo Barbershop

Sistema de agendamento e gestão para barbearia. Next.js 16 + TypeScript + Supabase (PostgreSQL, Auth e RLS).

## Rotas

- `/` — página do cliente: dobra única, apenas o agendamento (sem banners ou seções institucionais)
- `/admin/login` — login administrativo
- `/admin` — painel administrativo
- `/api/admin/users` — rota de servidor protegida para listar e criar administradores

## Página do cliente

Fluxo em 5 passos dentro de um único cartão:

1. Nome, sobrenome e WhatsApp (sem criar conta).
2. Serviço.
3. Barbeiro ou "primeiro disponível".
4. Data e horário realmente livre (consulta em tempo real).
5. Revisão e confirmação imediata.

O banco impede dois agendamentos sobrepostos para o mesmo barbeiro (restrição `appointments_no_overlap`).

## Painel administrativo

- Dashboard com agendamentos do dia, próximos horários, faturamento realizado e alertas de estoque.
- Agenda diária com mudança de status.
- Barbeiros: cadastrar, editar, foto, especialidades, ativar/inativar.
- Serviços: cadastrar, editar, preço, duração, ativar/inativar.
- Bloqueios de agenda por barbeiro.
- **Horários**: configurar dias, abertura, fechamento e intervalo dos slots pelo próprio painel.
- Estoque: produtos, entrada/saída com validação de saldo.
- **Administradores**: criar novos acessos direto pelo painel (rota de servidor com a Secret key).
- Configurações: nome, frase, WhatsApp, Instagram, endereço e URL da logo.

## 1. Preparar o banco no Supabase

1. Crie um projeto em `https://database.new`.
2. Abra **SQL Editor** e execute todo o conteúdo de `supabase/migrations/001_init.sql` (uma única vez).

## 2. Criar o primeiro administrador

1. **Authentication > Users > Add user** — cadastre e-mail e senha forte.
2. No SQL Editor, execute trocando o e-mail:

```sql
update public.profiles
set role = 'admin', full_name = 'Administrador Parrudo'
where id = (
  select id from auth.users where email = 'SEU-EMAIL@EXEMPLO.COM'
);
```

Os próximos administradores podem ser criados direto no painel, na aba **Administradores**.

## 3. Variáveis de ambiente

Crie `.env.local` na raiz (modelo em `.env.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

- URL e chave publicável: **Project Settings > API**.
- `SUPABASE_SECRET_KEY`: **Settings > API Keys > Secret key**. Usada somente no servidor, na rota `/api/admin/users`. Nunca use o prefixo `NEXT_PUBLIC_` nela e nunca a suba para o GitHub.

## 4. Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## 5. Publicar na Vercel

1. Suba esta pasta para um repositório no GitHub (o `package.json` precisa ficar na raiz do repositório).
2. Na Vercel: **Add New > Project**, importe o repositório.
3. Cadastre as três variáveis de ambiente.
4. **Deploy**. Se a Secret key for adicionada depois, faça **Redeploy**.

## Testes e verificação

```bash
npm test        # testes de unidade + smoke test
npm run lint    # ESLint
npm run build   # build de produção
```

## Segurança

- O navegador usa apenas a chave publicável; a Secret key fica restrita à rota de servidor.
- Todas as tabelas usam Row Level Security; apenas `profiles.role = 'admin'` gerencia dados.
- Agendamentos públicos passam exclusivamente pela função `create_appointment`, que revalida a disponibilidade.
- A rota `/api/admin/users` valida o token da sessão e o papel de admin antes de qualquer ação.
