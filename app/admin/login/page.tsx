'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/logo'
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client'

export default function AdminLoginPage() {
  const router = useRouter()
  const configured = isSupabaseConfigured()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!configured) return
    const supabase = getSupabaseBrowserClient()
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/admin')
    })
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
      setError(caught instanceof Error ? caught.message : 'Não foi possível entrar.')
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
          {!configured && <div className="setup-warning"><strong>Configuração necessária</strong><span>Preencha as variáveis do Supabase antes de acessar o painel.</span></div>}
          <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@parrudo.com.br" autoComplete="email" required /></label>
          <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha segura" autoComplete="current-password" required /></label>
          <button className="button button-gold" type="submit" disabled={!configured || loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
          {error && <p className="form-error">{error}</p>}
        </form>
      </section>
    </main>
  )
}
