import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!url || !secretKey) return null
  return { url, secretKey }
}

async function requireAdmin(request: NextRequest) {
  const env = getEnv()
  if (!env) {
    return { error: NextResponse.json({ error: 'SUPABASE_SECRET_KEY não configurada no servidor.' }, { status: 500 }) }
  }

  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    return { error: NextResponse.json({ error: 'Sessão não informada.' }, { status: 401 }) }
  }

  const admin = createClient(env.url, env.secretKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) {
    return { error: NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 }) }
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Apenas administradores podem gerenciar usuários.' }, { status: 403 }) }
  }

  return { admin }
}

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request)
  if ('error' in result) return result.error

  const { data, error } = await result.admin
    .from('profiles')
    .select('id, full_name, role, created_at')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ users: data })
}

export async function POST(request: NextRequest) {
  const result = await requireAdmin(request)
  if ('error' in result) return result.error

  let body: { email?: string; password?: string; fullName?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const fullName = String(body.fullName || '').trim()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'A senha precisa ter pelo menos 8 caracteres.' }, { status: 400 })
  }
  if (fullName.length < 3) {
    return NextResponse.json({ error: 'Informe o nome do administrador.' }, { status: 400 })
  }

  const { data: created, error: createError } = await result.admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message || 'Não foi possível criar o usuário.' }, { status: 400 })
  }

  const { error: profileError } = await result.admin
    .from('profiles')
    .upsert({ id: created.user.id, full_name: fullName, role: 'admin' })

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, id: created.user.id })
}
