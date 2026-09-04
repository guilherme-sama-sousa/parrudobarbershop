'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { BookingFlow } from '@/components/booking-flow'
import { Logo } from '@/components/logo'
import { getErrorMessage } from '@/lib/error-message'
import { bahiaDateTimeFormatter, currencyFormatter, maskPhone, normalizePhone } from '@/lib/format'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Barber, ClientAppointment, ClientProfile, Plan, Service, SiteSettings } from '@/lib/types'

interface ClientPortalProps {
  settings: SiteSettings
  services: Service[]
  barbers: Barber[]
  plans: Plan[]
  configured: boolean
  configurationError?: string
}

type AuthMode = 'login' | 'register' | 'forgot' | 'reset'
type ClientTab = 'home' | 'book' | 'appointments' | 'plans' | 'profile'

const clientTabLabels: Record<ClientTab, string> = {
  home: 'Início',
  book: 'Agendar',
  appointments: 'Meus horários',
  plans: 'Planos',
  profile: 'Perfil',
}

const clientTabIcons: Record<ClientTab, string> = {
  home: '⌂',
  book: '＋',
  appointments: '◷',
  plans: '◇',
  profile: '○',
}

const statusLabels = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

const demoClient: ClientProfile = {
  id: 'demo-client',
  user_id: 'demo-user',
  full_name: 'Cliente Demonstração',
  phone: '71999999999',
  email: 'cliente@exemplo.com',
}

export function ClientPortal({ settings, services, barbers, plans, configured, configurationError }: ClientPortalProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [session, setSession] = useState<Session | null>(null)
  const [client, setClient] = useState<ClientProfile | null>(null)
  const [appointments, setAppointments] = useState<ClientAppointment[]>([])
  const [tab, setTab] = useState<ClientTab>('home')
  const [checkingAuth, setCheckingAuth] = useState(configured)
  const [authBusy, setAuthBusy] = useState(false)
  const [pageBusy, setPageBusy] = useState(false)
  const [demoAccess, setDemoAccess] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const loadAppointments = useCallback(async (clientId: string) => {
    if (!configured) return
    const supabase = getSupabaseBrowserClient()
    const { data, error: appointmentsError } = await supabase
      .from('appointments')
      .select('id, starts_at, ends_at, status, notes, services(name, price, duration_minutes), barbers(name)')
      .eq('client_id', clientId)
      .order('starts_at', { ascending: false })
      .limit(100)
    if (appointmentsError) throw appointmentsError
    setAppointments((data ?? []) as unknown as ClientAppointment[])
  }, [configured])

  const loadClient = useCallback(async (userId: string) => {
    const supabase = getSupabaseBrowserClient()
    const { data, error: profileError } = await supabase
      .from('clients')
      .select('id, user_id, full_name, phone, email')
      .eq('user_id', userId)
      .maybeSingle()
    if (profileError) throw profileError
    if (!data) throw new Error('Este acesso não está vinculado a um cliente. Aplique a migração 003 ou crie um novo cadastro de cliente.')
    const profile = data as ClientProfile
    setClient(profile)
    setFullName(profile.full_name)
    setPhone(profile.phone)
    setEmail(profile.email || '')
    await loadAppointments(profile.id)
  }, [loadAppointments])

  useEffect(() => {
    if (!configured) return
    const supabase = getSupabaseBrowserClient()
    let active = true

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session) {
        try {
          await loadClient(data.session.user.id)
        } catch (caught) {
          setError(getErrorMessage(caught, 'Não foi possível abrir sua área.'))
        }
      }
      if (active) setCheckingAuth(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setAuthMode('reset')
      if (!nextSession) {
        setClient(null)
        setAppointments([])
      } else if (event !== 'INITIAL_SESSION') {
        window.setTimeout(() => {
          void loadClient(nextSession.user.id).catch((caught) => {
            setError(getErrorMessage(caught, 'Não foi possível abrir sua área.'))
          })
        }, 0)
      }
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [configured, loadClient])

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!configured) {
      setError(configurationError || 'Conecte o Supabase para criar e acessar contas reais.')
      return
    }

    setAuthBusy(true)
    try {
      const supabase = getSupabaseBrowserClient()
      if (authMode === 'login') {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (loginError) throw loginError
        if (!data.session) throw new Error('Não foi possível iniciar a sessão.')
        setSession(data.session)
        await loadClient(data.session.user.id)
        return
      }

      if (authMode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        })
        if (resetError) throw resetError
        setNotice('Enviamos o link de recuperação para o seu e-mail.')
        return
      }

      if (authMode === 'reset') {
        if (newPassword.length < 6) throw new Error('A nova senha precisa ter pelo menos 6 caracteres.')
        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
        if (updateError) throw updateError
        setNotice('Senha atualizada. Você já pode continuar.')
        setAuthMode('login')
        return
      }

      if (fullName.trim().split(/\s+/).length < 2) throw new Error('Informe nome e sobrenome.')
      const cleanPhone = normalizePhone(phone)
      if (cleanPhone.length < 10 || cleanPhone.length > 13) throw new Error('Informe um WhatsApp válido com DDD.')
      if (password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.')

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            account_type: 'client',
            full_name: fullName.trim(),
            phone: cleanPhone,
          },
        },
      })
      if (signUpError) throw signUpError
      if (data.session) {
        setSession(data.session)
        await loadClient(data.session.user.id)
      } else {
        setNotice('Cadastro criado. Confirme o e-mail recebido para entrar.')
        setAuthMode('login')
      }
    } catch (caught) {
      setError(getErrorMessage(caught, 'Não foi possível concluir.'))
    } finally {
      setAuthBusy(false)
    }
  }

  const signOut = async () => {
    if (configured) await getSupabaseBrowserClient().auth.signOut()
    setDemoAccess(false)
    setSession(null)
    setClient(null)
    setAppointments([])
    setTab('home')
  }

  const cancelAppointment = async (appointment: ClientAppointment) => {
    if (!window.confirm(`Cancelar ${appointment.services?.name || 'este horário'}?`)) return
    setPageBusy(true)
    setError('')
    try {
      const supabase = getSupabaseBrowserClient()
      const { error: cancelError } = await supabase.rpc('cancel_client_appointment', { p_appointment_id: appointment.id })
      if (cancelError) throw cancelError
      await loadAppointments(client!.id)
      setNotice('Agendamento cancelado.')
    } catch (caught) {
      setError(getErrorMessage(caught, 'Não foi possível cancelar o agendamento.'))
    } finally {
      setPageBusy(false)
    }
  }

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault()
    if (!client) return
    const cleanPhone = normalizePhone(phone)
    if (fullName.trim().split(/\s+/).length < 2) return setError('Informe nome e sobrenome.')
    if (cleanPhone.length < 10 || cleanPhone.length > 13) return setError('Informe um WhatsApp válido com DDD.')
    if (!configured) {
      setClient({ ...client, full_name: fullName.trim(), phone: cleanPhone })
      setNotice('Perfil atualizado na demonstração.')
      return
    }

    setPageBusy(true)
    setError('')
    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error: updateError } = await supabase
        .from('clients')
        .update({ full_name: fullName.trim(), phone: cleanPhone })
        .eq('id', client.id)
        .select('id, user_id, full_name, phone, email')
        .single()
      if (updateError) throw updateError
      setClient(data as ClientProfile)
      setNotice('Perfil atualizado.')
    } catch (caught) {
      setError(getErrorMessage(caught, 'Não foi possível atualizar seu perfil.'))
    } finally {
      setPageBusy(false)
    }
  }

  const activeClient = client || (demoAccess ? demoClient : null)
  const isAuthenticated = Boolean(session && client) || demoAccess
  const upcomingAppointments = useMemo(
    () => appointments
      .filter((item) => new Date(item.starts_at) > new Date() && item.status !== 'cancelled')
      .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)),
    [appointments],
  )
  const nextAppointment = upcomingAppointments[0]
  const whatsappLink = useMemo(() => {
    const digits = settings.whatsapp?.replace(/\D/g, '')
    return digits ? `https://wa.me/${digits}` : null
  }, [settings.whatsapp])

  if (checkingAuth) {
    return <main className="client-auth-shell"><div className="client-auth-card client-auth-loading"><Logo logoUrl={settings.logo_url} /><span>Carregando sua área...</span></div></main>
  }

  if (!isAuthenticated || !activeClient || authMode === 'reset') {
    return (
      <main className="client-auth-shell">
        <section className="client-auth-brand">
          <Logo logoUrl={settings.logo_url} />
          <div>
            <span className="eyebrow">SEU ESTILO, NO SEU TEMPO</span>
            <h1>Agende seu próximo corte em poucos toques.</h1>
            <p>Crie seu acesso para marcar horários, acompanhar seus agendamentos e conhecer os planos da Parrudo.</p>
          </div>
          <ul><li>Horários atualizados em tempo real</li><li>Histórico em um só lugar</li><li>Acesso rápido pelo celular</li></ul>
        </section>

        <section className="client-auth-form-wrap">
          <form className="client-auth-card" onSubmit={submitAuth}>
            <div className="auth-mobile-logo"><Logo logoUrl={settings.logo_url} compact /></div>
            {authMode !== 'forgot' && authMode !== 'reset' && (
              <div className="auth-tabs" role="tablist" aria-label="Acesso do cliente">
                <button type="button" role="tab" aria-selected={authMode === 'login'} className={authMode === 'login' ? 'active' : ''} onClick={() => { setAuthMode('login'); setError(''); setNotice('') }}>Entrar</button>
                <button type="button" role="tab" aria-selected={authMode === 'register'} className={authMode === 'register' ? 'active' : ''} onClick={() => { setAuthMode('register'); setError(''); setNotice('') }}>Criar conta</button>
              </div>
            )}

            <div className="auth-title">
              <span className="eyebrow">ÁREA DO CLIENTE</span>
              <h2>{authMode === 'login' ? 'Bom ter você de volta' : authMode === 'register' ? 'Seu cadastro Parrudo' : authMode === 'forgot' ? 'Recuperar senha' : 'Criar nova senha'}</h2>
              <p>{authMode === 'login' ? 'Entre para acessar seus horários.' : authMode === 'register' ? 'É rápido: preencha apenas os dados essenciais.' : authMode === 'forgot' ? 'Enviaremos um link seguro para o seu e-mail.' : 'Escolha uma senha segura para continuar.'}</p>
            </div>

            {authMode === 'register' && (
              <div className="auth-form-grid">
                <label>Nome e sobrenome<input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" placeholder="Ex.: Guilherme Silva" required /></label>
                <label>WhatsApp<input value={maskPhone(phone)} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="(71) 99999-9999" required /></label>
              </div>
            )}

            {authMode !== 'reset' && <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="voce@email.com" required /></label>}
            {(authMode === 'login' || authMode === 'register') && <label>Senha<input type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} placeholder="Mínimo de 6 caracteres" required /></label>}
            {authMode === 'reset' && <label>Nova senha<input type="password" minLength={6} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" placeholder="Mínimo de 6 caracteres" required /></label>}

            {authMode === 'login' && <button type="button" className="text-button auth-forgot" onClick={() => { setAuthMode('forgot'); setError(''); setNotice('') }}>Esqueci minha senha</button>}
            {(authMode === 'forgot' || authMode === 'reset') && <button type="button" className="text-button" onClick={() => { setAuthMode('login'); setError(''); setNotice('') }}>← Voltar ao login</button>}

            {error && <p className="form-error" role="alert">{error}</p>}
            {notice && <p className="form-success" role="status">{notice}</p>}

            <button type="submit" className="button button-gold" disabled={authBusy}>{authBusy ? 'Aguarde...' : authMode === 'login' ? 'Entrar' : authMode === 'register' ? 'Criar meu acesso' : authMode === 'forgot' ? 'Enviar link' : 'Salvar nova senha'}</button>
            {!configured && <button type="button" className="button button-ghost" onClick={() => { setDemoAccess(true); setClient(demoClient); setFullName(demoClient.full_name); setPhone(demoClient.phone); setEmail(demoClient.email || '') }}>Explorar demonstração</button>}

            {configurationError && <p className="auth-config-note">{configurationError}</p>}
            <a href="/admin/login" className="admin-link auth-admin-link">Acesso do administrador</a>
          </form>
        </section>
      </main>
    )
  }

  const navItems = (Object.keys(clientTabLabels) as ClientTab[]).filter((item) => item !== 'plans' || plans.length > 0)

  return (
    <main className="client-app-shell">
      <aside className="client-sidebar">
        <Logo logoUrl={settings.logo_url} compact />
        <nav aria-label="Navegação da área do cliente">
          {navItems.map((item) => <button type="button" key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}><span>{clientTabIcons[item]}</span>{clientTabLabels[item]}</button>)}
        </nav>
        <div className="client-sidebar-foot"><small>Conectado como</small><strong>{activeClient.full_name}</strong><button type="button" onClick={() => void signOut()}>Sair</button></div>
      </aside>

      <section className="client-app-content">
        <header className="client-topbar">
          <div><span className="eyebrow">PARRUDO BARBERSHOP</span><h1>{clientTabLabels[tab]}</h1></div>
          <button type="button" className="client-avatar" onClick={() => setTab('profile')} aria-label="Abrir perfil">{activeClient.full_name.charAt(0).toUpperCase()}</button>
        </header>

        {configurationError && <div className="client-alert client-alert-error" role="alert"><span>{configurationError}</span></div>}
        {error && <div className="client-alert client-alert-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')}>✕</button></div>}
        {notice && <div className="client-alert client-alert-success" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')}>✕</button></div>}

        <div className="client-view">
          {tab === 'home' && (
            <div className="client-home">
              <section className="client-welcome">
                <div><span className="eyebrow">OLÁ, {activeClient.full_name.split(' ')[0].toUpperCase()}</span><h2>Seu próximo visual começa aqui.</h2><p>Escolha o serviço, o profissional e o melhor horário para você.</p></div>
                <button type="button" className="button button-gold" onClick={() => setTab('book')}>Agendar agora</button>
              </section>

              <div className="client-dashboard-grid">
                <section className="client-panel next-appointment-card">
                  <div className="client-panel-heading"><div><span className="eyebrow">PRÓXIMO HORÁRIO</span><h3>{nextAppointment ? 'Tudo certo para te receber' : 'Sua agenda está livre'}</h3></div><span className="panel-icon">◷</span></div>
                  {nextAppointment ? <AppointmentCard appointment={nextAppointment} onCancel={() => void cancelAppointment(nextAppointment)} busy={pageBusy} /> : <div className="client-empty"><p>Você ainda não tem agendamentos futuros.</p><button type="button" className="text-button" onClick={() => setTab('book')}>Escolher um horário →</button></div>}
                </section>

                <section className="client-panel client-shortcuts">
                  <div className="client-panel-heading"><div><span className="eyebrow">ACESSO RÁPIDO</span><h3>O que você precisa?</h3></div></div>
                  <div className="shortcut-grid">
                    <button type="button" onClick={() => setTab('book')}><span>＋</span><strong>Novo agendamento</strong><small>{services.length} serviços disponíveis</small></button>
                    <button type="button" onClick={() => setTab('appointments')}><span>◷</span><strong>Meus horários</strong><small>{upcomingAppointments.length} futuro(s)</small></button>
                    {plans.length > 0 && <button type="button" onClick={() => setTab('plans')}><span>◇</span><strong>Planos mensais</strong><small>Benefícios para clientes</small></button>}
                    <button type="button" onClick={() => setTab('profile')}><span>○</span><strong>Meu perfil</strong><small>Dados e acesso</small></button>
                  </div>
                </section>
              </div>
            </div>
          )}

          {tab === 'book' && <section className="client-booking-view"><div className="client-view-title"><span className="eyebrow">NOVO AGENDAMENTO</span><h2>Reserve seu horário</h2><p>Escolha com calma. A disponibilidade é consultada em tempo real.</p></div><BookingFlow services={services} barbers={barbers} configured={configured} businessName={settings.business_name} clientName={activeClient.full_name} onBooked={async () => { if (configured) await loadAppointments(activeClient.id) }} /></section>}

          {tab === 'appointments' && (
            <section className="client-list-view">
              <div className="client-view-title"><span className="eyebrow">HISTÓRICO</span><h2>Meus horários</h2><p>Acompanhe os próximos atendimentos e os que já passaram.</p></div>
              <div className="client-appointment-list">{appointments.map((item) => <AppointmentCard key={item.id} appointment={item} onCancel={() => void cancelAppointment(item)} busy={pageBusy} />)}{!appointments.length && <div className="client-panel client-empty"><p>Nenhum agendamento encontrado.</p><button type="button" className="button button-gold" onClick={() => setTab('book')}>Fazer primeiro agendamento</button></div>}</div>
            </section>
          )}

          {tab === 'plans' && (
            <section className="client-list-view">
              <div className="client-view-title"><span className="eyebrow">CLUBE PARRUDO</span><h2>Planos mensais</h2><p>Mais frequência, praticidade e cuidado o mês inteiro.</p></div>
              <div className="client-plan-grid">{plans.map((plan) => <article key={plan.id} className="client-plan-card"><span className="eyebrow">PLANO</span><h3>{plan.name}</h3><p>{plan.description}</p><strong>{currencyFormatter.format(Number(plan.price))}<small>/mês</small></strong>{whatsappLink && <a href={`${whatsappLink}?text=${encodeURIComponent(`Olá! Quero saber mais sobre o plano ${plan.name}.`)}`} target="_blank" rel="noreferrer" className="button button-gold">Quero este plano</a>}</article>)}</div>
            </section>
          )}

          {tab === 'profile' && (
            <section className="client-profile-view">
              <div className="client-view-title"><span className="eyebrow">MINHA CONTA</span><h2>Dados do perfil</h2><p>Mantenha seu WhatsApp atualizado para facilitar o contato.</p></div>
              <form className="client-panel client-profile-form" onSubmit={saveProfile}>
                <div className="profile-avatar-large">{activeClient.full_name.charAt(0).toUpperCase()}</div>
                <div className="form-grid"><label>Nome e sobrenome<input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required /></label><label>WhatsApp<input value={maskPhone(phone)} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" required /></label><label className="span-2">E-mail de acesso<input value={email} readOnly aria-readonly="true" /></label></div>
                <div className="profile-actions"><button type="submit" className="button button-gold" disabled={pageBusy}>{pageBusy ? 'Salvando...' : 'Salvar perfil'}</button><button type="button" className="button button-ghost" onClick={() => void signOut()}>Sair da conta</button></div>
              </form>
            </section>
          )}
        </div>
      </section>

      <nav className="client-bottom-nav" aria-label="Navegação mobile">
        {navItems.map((item) => <button type="button" key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}><span>{clientTabIcons[item]}</span><small>{clientTabLabels[item]}</small></button>)}
      </nav>
    </main>
  )
}

function AppointmentCard({ appointment, onCancel, busy }: { appointment: ClientAppointment; onCancel: () => void; busy: boolean }) {
  const isFuture = new Date(appointment.starts_at) > new Date()
  const canCancel = isFuture && (appointment.status === 'scheduled' || appointment.status === 'confirmed')
  return (
    <article className="client-appointment-card">
      <div className="appointment-date-box"><strong>{new Date(appointment.starts_at).toLocaleDateString('pt-BR', { timeZone: 'America/Bahia', day: '2-digit' })}</strong><span>{new Date(appointment.starts_at).toLocaleDateString('pt-BR', { timeZone: 'America/Bahia', month: 'short' }).replace('.', '')}</span></div>
      <div className="appointment-card-info"><div><h3>{appointment.services?.name || 'Serviço'}</h3><span>{appointment.barbers?.name || 'Profissional'} • {bahiaDateTimeFormatter.format(new Date(appointment.starts_at))}</span></div><span className={`status-badge status-${appointment.status}`}>{statusLabels[appointment.status]}</span></div>
      {canCancel && <button type="button" className="cancel-client-appointment" onClick={onCancel} disabled={busy}>Cancelar</button>}
    </article>
  )
}
