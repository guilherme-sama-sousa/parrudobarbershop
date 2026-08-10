import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const required = [
  'app/page.tsx',
  'app/admin/page.tsx',
  'app/admin/login/page.tsx',
  'components/booking-flow.tsx',
  'components/admin-dashboard.tsx',
  'components/admin-finance.tsx',
  'app/api/admin/users/route.ts',
  'app/api/admin/bootstrap/route.ts',
  'supabase/migrations/001_init.sql',
  'supabase/migrations/003_area_cliente_e_fotos_estoque.sql',
  'supabase/migrations/004_financeiro_e_assinantes.sql',
  'supabase/migrations/005_planos_dos_assinantes.sql',
  '.env.example',
]

for (const file of required) {
  const info = await stat(join(root, file))
  assert.ok(info.size > 0, `${file} deve existir e não estar vazio`)
}

const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const manifest = JSON.parse(await readFile(join(root, 'public/manifest.webmanifest'), 'utf8'))
assert.equal(packageJson.scripts.test.includes('node --test'), true)
assert.equal(manifest.short_name, 'Parrudo')

const css = await readFile(join(root, 'app/globals.css'), 'utf8')
assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, 'CSS deve ter chaves balanceadas')

const sql = await readFile(join(root, 'supabase/migrations/001_init.sql'), 'utf8')
const clientSql = await readFile(join(root, 'supabase/migrations/003_area_cliente_e_fotos_estoque.sql'), 'utf8')
const financeSql = await readFile(join(root, 'supabase/migrations/004_financeiro_e_assinantes.sql'), 'utf8')
const subscriberPlansSql = await readFile(join(root, 'supabase/migrations/005_planos_dos_assinantes.sql'), 'utf8')
assert.match(sql, /enable row level security/i)
assert.match(sql, /appointments_no_overlap/i)
assert.match(sql, /create_appointment/i)
assert.match(sql, /get_available_slots/i)
assert.match(sql, /validate_blocked_time/i)
assert.match(sql, /validate_stock_movement/i)
assert.doesNotMatch(sql, /parrudo123/i)
assert.match(clientSql, /create_client_appointment/i)
assert.match(clientSql, /cancel_client_appointment/i)
assert.match(clientSql, /product-images/i)
assert.match(clientSql, /auth\.uid\(\)/i)
assert.match(financeSql, /create table if not exists public\.cash_transactions/i)
assert.match(financeSql, /create table if not exists public\.subscribers/i)
assert.match(financeSql, /create table if not exists public\.subscriber_payments/i)
assert.match(financeSql, /admins manage cash transactions/i)
assert.match(financeSql, /enable row level security/i)
assert.match(subscriberPlansSql, /add column if not exists plan_id/i)
assert.match(subscriberPlansSql, /references public\.plans\(id\)/i)
assert.match(subscriberPlansSql, /subscribers_plan_id_idx/i)

const login = await readFile(join(root, 'app/admin/login/page.tsx'), 'utf8')
assert.match(login, /signInWithPassword/)
assert.doesNotMatch(login, /senha padrão/i)

console.log('Smoke test: estrutura, segurança e arquivos críticos validados.')
