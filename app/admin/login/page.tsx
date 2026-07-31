'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/logo'
import { getErrorMessage } from '@/lib/error-message'
import { getSupabaseBrowserClient, getSupabaseConfigStatus } from '@/lib/supabase/client'

export default function AdminLoginPage() {
  const router = useRouter()
  const configStatus = getSupabaseConfigStatus()
  const configured = configStatus === 'ok'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const supabase = getSupabaseBrowserClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError
      router.replace('/admin')
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
          <p>Agenda, equipe, serviços, bloqueios e estoque com acesso protegido.</p>
        </div>
        <Link href="/" className="button button-outline">← Voltar ao site</Link>
      </section>
      <section className="admin-login-form-wrap">
        <form className="admin-login-form" onSubmit={submit}>
          <span className="admin-lock">P</span>
          <h2>Entrar no painel</h2>
          <p>Use o e-mail e a senha cadastrados no Supabase Auth.</p>
          {configStatus === 'missing' && <div className="setup-warning"><strong>Configuração necessária</strong><span>Preencha as variáveis do Supabase antes de acessar o painel.</span></div>}
          {configStatus === 'invalid_url' && <div className="setup-warning"><strong>URL do Supabase inválida</strong><span>Na Vercel, a variável NEXT_PUBLIC_SUPABASE_URL deve conter apenas https://SEU-PROJETO.supabase.co — sem o nome da variável, aspas ou espaços. Corrija e faça Redeploy.</span></div>}
          <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@parrudo.com.br" autoComplete="email" required /></label>
          <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha segura" autoComplete="current-password" required /></label>
          <button className="button button-gold" type="submit" disabled={!configured || loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
          {error && <p className="form-error">{error}</p>}
        </form>
      </section>
    </main>
  )
}
