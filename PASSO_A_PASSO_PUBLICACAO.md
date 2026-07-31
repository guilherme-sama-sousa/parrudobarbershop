# Passo a passo — subir o commit e publicar

## Opção A — Pelo terminal (recomendado)

O commit já está pronto dentro desta pasta. Só falta apontar para o seu repositório e enviar:

```bash
cd parrudo-barbershop-corrigido
git remote add origin https://github.com/SEU-USUARIO/parrudobarbershop.git
git push -f origin main
```

O `-f` é necessário porque a estrutura do repositório mudou (o projeto saiu da subpasta e agora fica na raiz).

## Opção B — Pelo site do GitHub

1. No repositório, apague TODOS os arquivos antigos (inclusive a pasta `parrudo-barbershop`).
2. Use **Add file > Upload files**.
3. Arraste TODO o conteúdo desta pasta (menos `node_modules` e `.next`, se existirem).
4. Confirme o commit na branch `main`.

Importante: o `package.json` precisa ficar na RAIZ do repositório. Era esse o principal erro do projeto antigo.

## Vercel — variáveis de ambiente

Em **Settings > Environment Variables**, confira as três:

| Variável | Valor | Onde pegar |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://SEU-PROJETO.supabase.co` | Supabase > Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | começa com `sb_publishable_` | Supabase > Project Settings > API |
| `SUPABASE_SECRET_KEY` | começa com `sb_secret_` | Supabase > Settings > API Keys > Secret key |

- A `SUPABASE_SECRET_KEY` NÃO leva o prefixo `NEXT_PUBLIC_` e nunca vai para o GitHub.
- Marque Production e Preview.
- Na Vercel, o campo **Root Directory** do projeto deve ficar vazio (raiz), já que o app não está mais em subpasta.

## Deploy

1. Depois do push, a Vercel faz o deploy automático.
2. Se adicionou a `SUPABASE_SECRET_KEY` depois do deploy, clique em **Redeploy**.

## Conferência final

```text
Cliente: https://SEU-PROJETO.vercel.app/          → dobra única, só o agendamento
Login:   https://SEU-PROJETO.vercel.app/admin/login
Painel:  https://SEU-PROJETO.vercel.app/admin     → agenda, barbeiros, serviços,
                                                    bloqueios, horários, estoque,
                                                    administradores, configurações
```

## Banco (somente se for instalação nova)

Execute `supabase/migrations/001_init.sql` uma única vez no SQL Editor e crie o primeiro admin conforme o README. Se o banco já existe desta implantação, não rode o SQL de novo.
