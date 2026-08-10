# Parrudo Barbershop

Sistema de agendamento e gestão para barbearia. Next.js 16 + TypeScript + Supabase (PostgreSQL, Auth e RLS).

## Rotas

- `/` — página do cliente: dobra única, apenas o agendamento (sem banners ou seções institucionais)
- `/admin/login` — login administrativo
- `/admin` — painel administrativo
- `/api/admin/users` — rota de servidor protegida para listar e criar administradores
- `/api/admin/bootstrap` — ativa o primeiro administrador a partir de um usuário já cadastrado (bloqueada após existir um admin)

## Área do cliente

O cliente cria um acesso simples com nome, sobrenome, WhatsApp, e-mail e senha. Depois do login, encontra uma experiência responsiva no estilo de aplicativo com:

- início com próximo horário e atalhos;
- novo agendamento em 4 passos;
- histórico e cancelamento de horários futuros;
- planos mensais e contratação pelo WhatsApp;
- edição de nome e telefone no perfil.

O banco impede dois agendamentos sobrepostos para o mesmo barbeiro (restrição `appointments_no_overlap`).

## Painel administrativo

- Dashboard com agendamentos do dia, alertas de estoque, entradas, saídas, saldo e faturamento mensal por barbeiro.
- Agenda diária com mudança de status.
- **Financeiro**: lançamento e exclusão de entradas e saídas, separação do faturamento por barbeiro, filtro por profissional e navegação entre meses passados ou futuros.
- **Assinantes**: cadastro com nome, telefone e plano previamente cadastrado, acompanhamento de meses passados ou futuros, baixa de pagamento, reabertura, edição, ativação/inativação e exclusão.
- Barbeiros: cadastrar, editar, foto, especialidades, ativar/inativar.
- Serviços: cadastrar, editar, preço, duração, ativar/inativar.
- Bloqueios de agenda por barbeiro.
- **Horários**: configurar dias, abertura, fechamento e intervalo dos slots pelo próprio painel.
- Estoque: produtos com foto, cadastro, edição, exclusão, ativação/inativação e entrada/saída com validação de saldo.
- **Administradores**: criar novos acessos direto pelo painel (rota de servidor com a Secret key).
- **Planos**: cadastrar e editar os planos mensais exibidos no site.
- Configurações: nome, frase, WhatsApp, Instagram, endereço e URL da logo (a logo oficial já vem em `public/logo.png` (fundo transparente) como padrão).

## Planos mensais

- Tabela `plans` com os planos Bronze, Prata, Ouro, Premium e Diamante (migração 002).
- Aparecem na página do cliente em um modal ("Planos mensais"), com contratação pelo WhatsApp.
- Editáveis no painel, aba **Planos**.

## 1. Preparar o banco no Supabase

1. Crie um projeto em `https://database.new`.
2. Abra **SQL Editor** e execute todo o conteúdo de `supabase/migrations/001_init.sql` (uma única vez).
3. Execute `supabase/migrations/002_precos_e_planos.sql` — aplica a tabela de preços oficial nos serviços e cria os planos mensais. Em banco já existente desta implantação, execute SOMENTE o 002.
4. Execute `supabase/migrations/003_area_cliente_e_fotos_estoque.sql` — cria o login do cliente, histórico/cancelamento seguro, foto dos produtos e o bucket de imagens.
5. Execute `supabase/migrations/004_financeiro_e_assinantes.sql` — cria o fluxo de caixa, faturamento por barbeiro, assinantes e baixas mensais.
6. Execute `supabase/migrations/005_planos_dos_assinantes.sql` — vincula cada assinante a um dos planos mensais previamente cadastrados.

Em um banco já publicado, execute apenas as migrações ainda não aplicadas, na ordem numérica.

## 2. Criar o primeiro administrador

1. No Supabase: **Authentication > Users > Add user > Create new user** — cadastre e-mail e senha forte (marque a confirmação automática do e-mail).
2. No site, abra `/admin/login` e clique em **"Primeiro acesso? Ativar administrador"**.
3. Informe o e-mail e a senha desse usuário. Ele vira administrador e já entra no painel.

Esse fluxo só funciona enquanto não existir nenhum administrador. Os próximos são criados dentro do painel, na aba **Administradores**. (Alternativa via SQL: `update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'SEU-EMAIL');`)

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
