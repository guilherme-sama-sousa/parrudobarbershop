'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/logo'
import { getErrorMessage } from '@/lib/error-message'
import { getSupabaseBrowserClient, getSupabaseConfigStatus } from '@/lib/supabase/client'

type Mode = 'login' | 'bootstrap'

export default function AdminLoginPage() {
  const router = useRouter()
  const configStatus = getSupabaseConfigStatus()
  const configured = configStatus === 'ok'
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!configured) return
    try {
      const supabase = getSupabaseBrowserClient()
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session) router.replace('/admin')
      })
    } catch {
      // Configuração inválida: a página continua aberta mostrando o aviso.
    }
  }, [configured, router])

  const signIn = async () => {
    const supabase = getSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) throw authError
    router.replace('/admin')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      if (mode === 'bootstrap') {
        const response = await fetch('/api/admin/bootstrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Não foi possível ativar o administrador.')
        setSuccess('Administrador ativado! Entrando no painel...')
      }
      await signIn()
    } catch (caught) {
      setError(getErrorMessage(caught, 'Não foi possível entrar.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-brand">
        <Logo />
        <div>
          <span className="eyebrow">PAINEL ADMINISTRATIVO</span>
          <h1>Controle a operação em um só lugar.</h1>
          <p>Agenda, equipe, serviços, planos, bloqueios e estoque com acesso protegido.</p>
        </div>
        <Link href="/" className="button button-outline">← Voltar ao site</Link>
      </section>
      <section className="admin-login-form-wrap">
        <form className="admin-login-form" onSubmit={submit}>
          <span className="admin-lock">P</span>
          <h2>{mode === 'login' ? 'Entrar no painel' : 'Ativar primeiro administrador'}</h2>
          <p>
            {mode === 'login'
              ? 'Use o e-mail e a senha do seu usuário administrador.'
              : 'Informe o e-mail e a senha de um usuário já cadastrado no Supabase (Authentication > Users). Ele será promovido a administrador. Funciona apenas enquanto não existir nenhum administrador.'}
          </p>
          {configStatus === 'missing' && <div className="setup-warning"><strong>Configuração necessária</strong><span>Preencha as variáveis do Supabase antes de acessar o painel.</span></div>}
          {configStatus === 'invalid_url' && <div className="setup-warning"><strong>URL do Supabase inválida</strong><span>Na Vercel, a variável NEXT_PUBLIC_SUPABASE_URL deve conter apenas https://SEU-PROJETO.supabase.co — sem o nome da variável, aspas ou espaços. Corrija e faça Redeploy.</span></div>}
          <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@parrudo.com.br" autoComplete="email" required /></label>
          <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha segura" autoComplete="current-password" required /></label>
          <button className="button button-gold" type="submit" disabled={!configured || loading}>
            {loading ? (mode === 'login' ? 'Entrando...' : 'Ativando...') : mode === 'login' ? 'Entrar' : 'Ativar e entrar'}
          </button>
          <div className="login-mode-switch">
            {mode === 'login' ? (
              <button type="button" onClick={() => { setMode('bootstrap'); setError(''); setSuccess('') }}>
                Primeiro acesso? Ativar administrador
              </button>
            ) : (
              <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess('') }}>
                ← Voltar para o login
              </button>
            )}
          </div>
          {success && <p className="form-success">{success}</p>}
          {error && <p className="form-error">{error}</p>}
        </form>
      </section>
    </main>
  )
}
