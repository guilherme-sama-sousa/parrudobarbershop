import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const required = [
  'app/page.tsx',
  'app/admin/page.tsx',
  'app/admin/login/page.tsx',
  'components/booking-flow.tsx',
  'components/admin-dashboard.tsx',
  'app/api/admin/users/route.ts',
  'supabase/migrations/001_init.sql',
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
assert.match(sql, /enable row level security/i)
assert.match(sql, /appointments_no_overlap/i)
assert.match(sql, /create_appointment/i)
assert.match(sql, /get_available_slots/i)
assert.match(sql, /validate_blocked_time/i)
assert.match(sql, /validate_stock_movement/i)
assert.doesNotMatch(sql, /parrudo123/i)

const login = await readFile(join(root, 'app/admin/login/page.tsx'), 'utf8')
assert.match(login, /signInWithPassword/)
assert.doesNotMatch(login, /senha padrão/i)

console.log('Smoke test: estrutura, segurança e arquivos críticos validados.')
