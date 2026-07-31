import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Primeiro acesso: transforma um usuário JÁ CADASTRADO no Supabase Auth
 * no primeiro administrador do painel.
 *
 * Segurança:
 * - Só funciona enquanto NÃO existir nenhum administrador (depois disso, 403).
 * - Exige e-mail e senha válidos do usuário (as credenciais são verificadas).
 * - Novos administradores seguintes são criados dentro do painel, na aba Administradores.
 */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const secretKey = process.env.SUPABASE_SECRET_KEY

  if (!url || !publishableKey || !secretKey) {
    return NextResponse.json({ error: 'Variáveis do Supabase ausentes no servidor.' }, { status: 500 })
  }
  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: 'NEXT_PUBLIC_SUPABASE_URL inválida no servidor.' }, { status: 500 })
  }

  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  if (!email || !password) {
    return NextResponse.json({ error: 'Informe e-mail e senha.' }, { status: 400 })
  }

  const admin = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } })

  // Bloqueia se já existir qualquer administrador.
  const { count, error: countError } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 400 })
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Já existe um administrador. Peça a ele para criar seu acesso no painel, aba Administradores.' },
      { status: 403 },
    )
  }

  // Verifica as credenciais do usuário previamente cadastrado.
  const verifier = createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: signIn, error: signInError } = await verifier.auth.signInWithPassword({ email, password })
  if (signInError || !signIn.user) {
    return NextResponse.json(
      { error: 'E-mail ou senha incorretos. Cadastre o usuário primeiro no Supabase (Authentication > Users > Add user).' },
      { status: 401 },
    )
  }

  const fullName =
    (signIn.user.user_metadata?.full_name as string | undefined) || email.split('@')[0] || 'Administrador'

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: signIn.user.id, full_name: fullName, role: 'admin' })

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
