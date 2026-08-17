'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CashFlowView, FinanceDashboardPanel, SubscribersView } from '@/components/admin-finance'
import { Logo } from '@/components/logo'
import { SalesModal } from '@/components/sales-modal'
import { bahiaDateTimeFormatter, currencyFormatter, toLocalDateInput } from '@/lib/format'
import { getErrorMessage } from '@/lib/error-message'
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client'
import type { AdminUser, Appointment, AppointmentStatus, Barber, BlockedTime, BusinessHour, CashTransaction, Plan, ProductSale, Service, SiteSettings, StockBalance, Subscriber, SubscriberPayment } from '@/lib/types'

type Tab = 'dashboard' | 'agenda' | 'finance' | 'subscribers' | 'barbers' | 'services' | 'plans' | 'blocks' | 'hours' | 'stock' | 'admins' | 'settings'

const tabLabels: Record<Tab, string> = {
  dashboard: 'Dashboard',
  agenda: 'Agenda',
  finance: 'Financeiro',
  subscribers: 'Assinantes',
  barbers: 'Barbeiros',
  services: 'Serviços',
  plans: 'Planos',
  blocks: 'Bloqueios',
  hours: 'Horários',
  stock: 'Estoque',
  admins: 'Administradores',
  settings: 'Configurações',
}

const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const statusLabel: Record<AppointmentStatus, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

const initialSettings: SiteSettings = {
  id: 1,
  business_name: 'Parrudo Barbershop',
  tagline: '',
  whatsapp: '',
  instagram: '',
  address: '',
  logo_url: '',
}

export function AdminDashboard() {
  const router = useRouter()
  const configured = isSupabaseConfigured()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)
  const [notice, setNotice] = useState('')
  const [profileName, setProfileName] = useState('Administrador')
  const [settings, setSettings] = useState<SiteSettings>(initialSettings)
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [blocks, setBlocks] = useState<BlockedTime[]>([])
  const [stock, setStock] = useState<StockBalance[]>([])
  const [hours, setHours] = useState<BusinessHour[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([])
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [subscriberPayments, setSubscriberPayments] = useState<SubscriberPayment[]>([])
  const [financeReady, setFinanceReady] = useState(true)
  const [productSales, setProductSales] = useState<ProductSale[]>([])
  const [salesReady, setSalesReady] = useState(true)
  const [saleModalOpen, setSaleModalOpen] = useState(false)
  const [agendaDate, setAgendaDate] = useState(toLocalDateInput())

  const flash = (message: string) => {
    setError('')
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }

  const loadAll = useCallback(async () => {
    if (!configured) {
      router.replace('/admin/login')
      return
    }

    try {
      const supabase = getSupabaseBrowserClient()
      const { data: sessionData } = await supabase.auth.getSession()
      setLoading(true)
      setError('')
      setLoadFailed(false)
      if (!sessionData.session) {
        router.replace('/admin/login')
        return
      }

      const userId = sessionData.session.user.id
      const [profileResult, settingsResult, servicesResult, barbersResult, appointmentsResult, blocksResult, stockResult, hoursResult, plansResult, cashResult, subscribersResult, subscriberPaymentsResult, productSalesResult] = await Promise.all([
        supabase.from('profiles').select('full_name, role').eq('id', userId).single(),
        supabase.from('site_settings').select('*').eq('id', 1).single(),
        supabase.from('services').select('*').order('name'),
        supabase.from('barbers').select('*').order('name'),
        supabase.from('appointments').select('id, starts_at, ends_at, status, notes, clients(full_name, phone), services(name, price), barbers(name)').order('starts_at', { ascending: false }).limit(300),
        supabase.from('blocked_times').select('id, starts_at, ends_at, reason, barbers(name)').order('starts_at', { ascending: false }).limit(200),
        supabase.from('stock_balances').select('*').order('name'),
        supabase.from('business_hours').select('*').order('day_of_week'),
        supabase.from('plans').select('*').order('sort_order'),
        supabase.from('cash_transactions').select('id, movement_type, amount, description, barber_id, occurred_on, created_at, barbers(name)').order('occurred_on', { ascending: false }).order('created_at', { ascending: false }).limit(1000),
        supabase.from('subscribers').select('*, plans(id, name, price, active), barbers(id, name, active)').order('full_name'),
        supabase.from('subscriber_payments').select('id, subscriber_id, reference_month, paid_at, created_at, cash_transaction_id, amount, barber_id, plan_id').order('reference_month', { ascending: false }).limit(2000),
        supabase.from('product_sales').select('id, product_id, barber_id, quantity, unit_price, total_amount, sold_on, created_at, stock_products(name), barbers(name)').order('sold_on', { ascending: false }).order('created_at', { ascending: false }).limit(100),
      ])

      if (profileResult.error) throw new Error('Usuário sem perfil administrativo. Verifique a etapa de criação do primeiro admin no README.')
      if (profileResult.data.role !== 'admin') throw new Error('Este usuário não possui permissão de administrador.')
      setProfileName(profileResult.data.full_name || 'Administrador')
      if (settingsResult.data) setSettings(settingsResult.data as SiteSettings)
      if (servicesResult.error) throw servicesResult.error
      if (barbersResult.error) throw barbersResult.error
      if (appointmentsResult.error) throw appointmentsResult.error
      if (blocksResult.error) throw blocksResult.error
      if (stockResult.error) throw stockResult.error
      if (hoursResult.error) throw hoursResult.error
      setServices((servicesResult.data ?? []) as Service[])
      setBarbers((barbersResult.data ?? []) as Barber[])
      setAppointments((appointmentsResult.data ?? []) as unknown as Appointment[])
      setBlocks((blocksResult.data ?? []) as unknown as BlockedTime[])
      setStock((stockResult.data ?? []) as StockBalance[])
      setHours((hoursResult.data ?? []) as BusinessHour[])
      // Planos são opcionais até a migração 002 rodar.
      setPlans(plansResult.error ? [] : ((plansResult.data ?? []) as Plan[]))
      const financeIsReady = !cashResult.error && !subscribersResult.error && !subscriberPaymentsResult.error
      setFinanceReady(financeIsReady)
      setCashTransactions(financeIsReady ? ((cashResult.data ?? []) as unknown as CashTransaction[]) : [])
      setSubscribers(financeIsReady ? ((subscribersResult.data ?? []) as unknown as Subscriber[]) : [])
      setSubscriberPayments(financeIsReady ? ((subscriberPaymentsResult.data ?? []) as SubscriberPayment[]) : [])
      setSalesReady(!productSalesResult.error)
      setProductSales(productSalesResult.error ? [] : ((productSalesResult.data ?? []) as unknown as ProductSale[]))
    } catch (caught) {
      setLoadFailed(true)
      setError(getErrorMessage(caught, 'Falha ao carregar o painel.'))
    } finally {
      setLoading(false)
    }
  }, [configured, router])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) void loadAll() })
    return () => { cancelled = true }
  }, [loadAll])

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.replace('/admin/login')
  }

  const openTab = (nextTab: Tab) => {
    setTab(nextTab)
    setMenuOpen(false)
  }

  const todayAppointments = useMemo(() => appointments.filter((item) => toLocalDateInput(new Date(item.starts_at)) === agendaDate), [appointments, agendaDate])
  const upcoming = useMemo(() => appointments.filter((item) => new Date(item.starts_at) >= new Date() && item.status !== 'cancelled').sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)).slice(0, 6), [appointments])
  const completedRevenue = useMemo(() => appointments.filter((item) => item.status === 'completed').reduce((sum, item) => sum + Number(item.services?.price || 0), 0), [appointments])
  const lowStock = useMemo(() => stock.filter((item) => item.current_stock <= item.minimum_stock), [stock])

  if (loading) return <main className="admin-loading"><Logo /><span>Carregando painel...</span></main>

  return (
    <main className="admin-app">
      <aside className={menuOpen ? 'admin-sidebar open' : 'admin-sidebar'}>
        <div className="sidebar-brand"><Logo compact /></div>
        <nav>
          {(Object.keys(tabLabels) as Tab[]).map((item) => <button type="button" key={item} className={tab === item ? 'active' : ''} aria-current={tab === item ? 'page' : undefined} onClick={() => openTab(item)}><span aria-hidden="true">{tabIcon(item)}</span>{tabLabels[item]}</button>)}
        </nav>
        <div className="sidebar-user"><span>{profileName.charAt(0).toUpperCase()}</span><div><strong>{profileName}</strong><small>Administrador</small></div></div>
        <button type="button" className="sidebar-signout" onClick={() => void signOut()}>Sair do painel</button>
      </aside>
      {menuOpen && <button className="sidebar-backdrop" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />}

      <section className="admin-content">
        <header className="admin-topbar">
          <button type="button" className="mobile-menu" aria-label="Abrir menu do painel" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>☰</button>
          <div><span className="eyebrow">PARRUDO ADMIN</span><h1>{tabLabels[tab]}</h1></div>
          <div className="topbar-actions"><button type="button" className="button button-gold button-small sale-shortcut" onClick={() => setSaleModalOpen(true)}>＋ Venda</button><a className="button button-outline button-small" href="/" target="_blank" rel="noreferrer">Ver site</a><button type="button" className="button button-dark button-small" onClick={() => void loadAll()}>Atualizar</button></div>
        </header>

        {error && <div className="admin-error" role="alert"><strong>{loadFailed ? 'Não foi possível abrir o painel.' : 'Não foi possível concluir a operação.'}</strong><span>{error}</span>{loadFailed && <button type="button" onClick={() => void loadAll()}>Tentar novamente</button>}</div>}
        {notice && <div className="admin-notice" role="status" aria-live="polite">✓ {notice}</div>}

        {!loadFailed && tab === 'dashboard' && <DashboardView appointments={appointments} upcoming={upcoming} barbers={barbers} services={services} revenue={completedRevenue} lowStock={lowStock} cashTransactions={cashTransactions} subscribers={subscribers} subscriberPayments={subscriberPayments} financeReady={financeReady} />}
        {!loadFailed && tab === 'agenda' && <AgendaView appointments={todayAppointments} date={agendaDate} setDate={setAgendaDate} onStatus={async (id, status) => { const supabase = getSupabaseBrowserClient(); const { error: updateError } = await supabase.from('appointments').update({ status }).eq('id', id); if (updateError) return setError(updateError.message); flash('Status atualizado.'); await loadAll() }} />}
        {!loadFailed && tab === 'finance' && <CashFlowView cashTransactions={cashTransactions} barbers={barbers} financeReady={financeReady} onSaved={async () => { flash('Lançamento atualizado.'); await loadAll() }} setError={setError} />}
        {!loadFailed && tab === 'subscribers' && <SubscribersView subscribers={subscribers} subscriberPayments={subscriberPayments} plans={plans} barbers={barbers} financeReady={financeReady} onSaved={async () => { flash('Assinantes atualizados e caixa sincronizado.'); await loadAll() }} setError={setError} />}
        {!loadFailed && tab === 'barbers' && <BarbersView barbers={barbers} onSaved={async () => { flash('Barbeiro salvo.'); await loadAll() }} setError={setError} />}
        {!loadFailed && tab === 'services' && <ServicesView services={services} onSaved={async () => { flash('Serviço salvo.'); await loadAll() }} setError={setError} />}
        {!loadFailed && tab === 'plans' && <PlansView plans={plans} onSaved={async () => { flash('Plano salvo.'); await loadAll() }} setError={setError} />}
        {!loadFailed && tab === 'blocks' && <BlocksView blocks={blocks} barbers={barbers} onSaved={async () => { flash('Bloqueio atualizado.'); await loadAll() }} setError={setError} />}
        {!loadFailed && tab === 'stock' && <StockView stock={stock} onSaved={async () => { flash('Estoque atualizado.'); await loadAll() }} setError={setError} />}
        {!loadFailed && tab === 'hours' && <HoursView hours={hours} onSaved={async () => { flash('Horários atualizados.'); await loadAll() }} setError={setError} />}
        {!loadFailed && tab === 'admins' && <AdminsView setError={setError} onSaved={() => flash('Administrador criado.')} />}
        {!loadFailed && tab === 'settings' && <SettingsView settings={settings} setSettings={setSettings} onSaved={() => flash('Configurações salvas.')} setError={setError} />}
      </section>
      {saleModalOpen && <SalesModal stock={stock} barbers={barbers} sales={productSales} salesReady={salesReady} onClose={() => setSaleModalOpen(false)} onSaved={async () => { flash('Venda atualizada; estoque e caixa sincronizados.'); await loadAll() }} setError={setError} />}
    </main>
  )
}

function DashboardView({ appointments, upcoming, barbers, services, revenue, lowStock, cashTransactions, subscribers, subscriberPayments, financeReady }: { appointments: Appointment[]; upcoming: Appointment[]; barbers: Barber[]; services: Service[]; revenue: number; lowStock: StockBalance[]; cashTransactions: CashTransaction[]; subscribers: Subscriber[]; subscriberPayments: SubscriberPayment[]; financeReady: boolean }) {
  const today = toLocalDateInput()
  const todayCount = appointments.filter((item) => toLocalDateInput(new Date(item.starts_at)) === today && item.status !== 'cancelled').length
  return <div className="admin-stack">
    <div className="admin-stats">
      <article><span>Hoje</span><strong>{todayCount}</strong><small>agendamentos ativos</small></article>
      <article><span>Equipe</span><strong>{barbers.filter((item) => item.active).length}</strong><small>barbeiros ativos</small></article>
      <article><span>Serviços</span><strong>{services.filter((item) => item.active).length}</strong><small>opções disponíveis</small></article>
      <article><span>Realizado</span><strong>{currencyFormatter.format(revenue)}</strong><small>serviços concluídos</small></article>
    </div>
    <div className="admin-two-columns">
      <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">AGENDA</span><h2>Próximos horários</h2></div></div><div className="appointment-list">{upcoming.map((item) => <AppointmentRow key={item.id} item={item} />)}{!upcoming.length && <EmptyState text="Nenhum agendamento futuro." />}</div></section>
      <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">ESTOQUE</span><h2>Reposição necessária</h2></div></div><div className="stock-alert-list">{lowStock.map((item) => <div key={item.id}><span>{item.name}</span><strong>{item.current_stock} {item.unit}</strong></div>)}{!lowStock.length && <EmptyState text="Estoque dentro dos mínimos." />}</div></section>
    </div>
    <FinanceDashboardPanel cashTransactions={cashTransactions} barbers={barbers} subscribers={subscribers} subscriberPayments={subscriberPayments} financeReady={financeReady} />
  </div>
}

function AgendaView({ appointments, date, setDate, onStatus }: { appointments: Appointment[]; date: string; setDate: (value: string) => void; onStatus: (id: string, status: AppointmentStatus) => Promise<void> }) {
  return <section className="admin-panel"><div className="panel-heading panel-heading-wrap"><div><span className="eyebrow">AGENDA DO DIA</span><h2>{appointments.length} agendamento(s)</h2></div><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div><div className="admin-table-wrap"><table><thead><tr><th>Horário</th><th>Cliente</th><th>WhatsApp</th><th>Serviço</th><th>Barbeiro</th><th>Status</th></tr></thead><tbody>{appointments.map((item) => <tr key={item.id}><td>{new Date(item.starts_at).toLocaleTimeString('pt-BR', { timeZone: 'America/Bahia', hour: '2-digit', minute: '2-digit' })}</td><td>{item.clients?.full_name}</td><td>{item.clients?.phone}</td><td>{item.services?.name}</td><td>{item.barbers?.name}</td><td><select className={`status-select status-${item.status}`} value={item.status} onChange={(event) => void onStatus(item.id, event.target.value as AppointmentStatus)}>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td></tr>)}{!appointments.length && <tr><td colSpan={6}><EmptyState text="Nenhum agendamento nesta data." /></td></tr>}</tbody></table></div></section>
}

function BarbersView({ barbers, onSaved, setError }: { barbers: Barber[]; onSaved: () => Promise<void>; setError: (value: string) => void }) {
  const [editingId, setEditingId] = useState('')
  const [name, setName] = useState('')
  const [specialties, setSpecialties] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')

  const reset = () => { setEditingId(''); setName(''); setSpecialties(''); setPhotoUrl('') }
  const edit = (barber: Barber) => { setEditingId(barber.id); setName(barber.name); setSpecialties(barber.specialties.join(', ')); setPhotoUrl(barber.photo_url || ''); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const supabase = getSupabaseBrowserClient()
    const payload = { name, specialties: specialties.split(',').map((item) => item.trim()).filter(Boolean), photo_url: photoUrl || null }
    const query = editingId ? supabase.from('barbers').update(payload).eq('id', editingId) : supabase.from('barbers').insert(payload)
    const { error } = await query
    if (error) return setError(error.message)
    reset()
    await onSaved()
  }
  const toggle = async (barber: Barber) => { const supabase = getSupabaseBrowserClient(); const { error } = await supabase.from('barbers').update({ active: !barber.active }).eq('id', barber.id); if (error) return setError(error.message); await onSaved() }

  return <div className="admin-stack"><form className="admin-panel admin-form" onSubmit={submit}><div className="panel-heading"><div><span className="eyebrow">{editingId ? 'EDITAR PROFISSIONAL' : 'NOVO PROFISSIONAL'}</span><h2>{editingId ? 'Atualizar barbeiro' : 'Cadastrar barbeiro'}</h2></div>{editingId && <button type="button" className="text-button" onClick={reset}>Cancelar edição</button>}</div><div className="form-grid"><label>Nome<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Especialidades<input value={specialties} onChange={(event) => setSpecialties(event.target.value)} placeholder="Degradê, barba, navalhado" /></label><label className="span-2">URL da foto<input type="url" value={photoUrl} onChange={(event) => setPhotoUrl(event.target.value)} placeholder="https://..." /></label></div><button className="button button-gold" type="submit">{editingId ? 'Salvar alterações' : 'Cadastrar barbeiro'}</button></form><div className="admin-card-grid">{barbers.map((barber) => <article className="manage-card" key={barber.id}><div className="manage-avatar">{barber.photo_url ? <img src={barber.photo_url} alt="" /> : barber.name.charAt(0)}</div><div><h3>{barber.name}</h3><p>{barber.specialties.join(' • ') || 'Sem especialidades informadas'}</p></div><div className="manage-actions"><button className="edit-button" onClick={() => edit(barber)}>Editar</button><button className={barber.active ? 'toggle active' : 'toggle'} onClick={() => void toggle(barber)}>{barber.active ? 'Ativo' : 'Inativo'}</button></div></article>)}</div></div>
}

function ServicesView({ services, onSaved, setError }: { services: Service[]; onSaved: () => Promise<void>; setError: (value: string) => void }) {
  const [editingId, setEditingId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [duration, setDuration] = useState('30')

  const reset = () => { setEditingId(''); setName(''); setDescription(''); setPrice(''); setDuration('30') }
  const edit = (service: Service) => { setEditingId(service.id); setName(service.name); setDescription(service.description || ''); setPrice(String(service.price)); setDuration(String(service.duration_minutes)); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const supabase = getSupabaseBrowserClient()
    const payload = { name, description: description || null, price: Number(price), duration_minutes: Number(duration) }
    const query = editingId ? supabase.from('services').update(payload).eq('id', editingId) : supabase.from('services').insert(payload)
    const { error } = await query
    if (error) return setError(error.message)
    reset()
    await onSaved()
  }
  const toggle = async (service: Service) => { const supabase = getSupabaseBrowserClient(); const { error } = await supabase.from('services').update({ active: !service.active }).eq('id', service.id); if (error) return setError(error.message); await onSaved() }

  return <div className="admin-stack"><form className="admin-panel admin-form" onSubmit={submit}><div className="panel-heading"><div><span className="eyebrow">{editingId ? 'EDITAR SERVIÇO' : 'NOVO SERVIÇO'}</span><h2>{editingId ? 'Atualizar serviço e preço' : 'Cadastrar serviço e preço'}</h2></div>{editingId && <button type="button" className="text-button" onClick={reset}>Cancelar edição</button>}</div><div className="form-grid"><label>Nome<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Preço (R$)<input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required /></label><label>Duração (min)<input type="number" min="5" step="5" value={duration} onChange={(event) => setDuration(event.target.value)} required /></label><label>Descrição<input value={description} onChange={(event) => setDescription(event.target.value)} /></label></div><button className="button button-gold" type="submit">{editingId ? 'Salvar alterações' : 'Cadastrar serviço'}</button></form><div className="admin-card-grid">{services.map((service) => <article className="manage-card service-manage-card" key={service.id}><div><h3>{service.name}</h3><p>{service.description || 'Sem descrição'}</p><small>{service.duration_minutes} min</small></div><strong>{currencyFormatter.format(Number(service.price))}</strong><div className="manage-actions"><button className="edit-button" onClick={() => edit(service)}>Editar</button><button className={service.active ? 'toggle active' : 'toggle'} onClick={() => void toggle(service)}>{service.active ? 'Ativo' : 'Inativo'}</button></div></article>)}</div></div>
}

function BlocksView({ blocks, barbers, onSaved, setError }: { blocks: BlockedTime[]; barbers: Barber[]; onSaved: () => Promise<void>; setError: (value: string) => void }) {
  const [barberId, setBarberId] = useState('')
  const [date, setDate] = useState(toLocalDateInput())
  const [start, setStart] = useState('12:00')
  const [end, setEnd] = useState('13:00')
  const [reason, setReason] = useState('')
  const submit = async (event: FormEvent) => { event.preventDefault(); const supabase = getSupabaseBrowserClient(); const { error } = await supabase.from('blocked_times').insert({ barber_id: barberId, starts_at: `${date}T${start}:00-03:00`, ends_at: `${date}T${end}:00-03:00`, reason: reason || null }); if (error) return setError(error.message); setReason(''); await onSaved() }
  const remove = async (id: string) => { const supabase = getSupabaseBrowserClient(); const { error } = await supabase.from('blocked_times').delete().eq('id', id); if (error) return setError(error.message); await onSaved() }
  return <div className="admin-stack"><form className="admin-panel admin-form" onSubmit={submit}><div className="panel-heading"><div><span className="eyebrow">INDISPONIBILIDADE</span><h2>Bloquear um período</h2></div></div><div className="form-grid"><label>Barbeiro<select value={barberId} onChange={(event) => setBarberId(event.target.value)} required><option value="">Selecione</option>{barbers.filter((item) => item.active).map((barber) => <option key={barber.id} value={barber.id}>{barber.name}</option>)}</select></label><label>Data<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label>Início<input type="time" value={start} onChange={(event) => setStart(event.target.value)} required /></label><label>Fim<input type="time" value={end} onChange={(event) => setEnd(event.target.value)} required /></label><label className="span-2">Motivo<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Almoço, folga, compromisso..." /></label></div><button className="button button-gold" type="submit">Bloquear horário</button></form><section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">HISTÓRICO</span><h2>Horários bloqueados</h2></div></div><div className="block-list">{blocks.map((block) => <div key={block.id}><div><strong>{block.barbers?.name}</strong><span>{bahiaDateTimeFormatter.format(new Date(block.starts_at))} até {new Date(block.ends_at).toLocaleTimeString('pt-BR', { timeZone: 'America/Bahia', hour: '2-digit', minute: '2-digit' })}</span><small>{block.reason || 'Sem motivo informado'}</small></div><button onClick={() => void remove(block.id)}>Liberar</button></div>)}{!blocks.length && <EmptyState text="Nenhum período bloqueado." />}</div></section></div>
}

function StockView({ stock, onSaved, setError }: { stock: StockBalance[]; onSaved: () => Promise<void>; setError: (value: string) => void }) {
  const [editingId, setEditingId] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Bebida')
  const [unit, setUnit] = useState('un')
  const [minimum, setMinimum] = useState('5')
  const [price, setPrice] = useState('0.00')
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [savingProduct, setSavingProduct] = useState(false)
  const [productId, setProductId] = useState('')
  const [movementType, setMovementType] = useState<'entry' | 'exit'>('entry')
  const [quantity, setQuantity] = useState('1')
  const [reason, setReason] = useState('')
  const [savingMovement, setSavingMovement] = useState(false)

  const resetProduct = () => {
    setEditingId('')
    setName('')
    setCategory('Bebida')
    setUnit('un')
    setMinimum('5')
    setPrice('0.00')
    setPhotoUrl('')
    setPhotoFile(null)
    setPhotoPreview('')
  }

  const editProduct = (product: StockBalance) => {
    setEditingId(product.id)
    setName(product.name)
    setCategory(product.category || '')
    setUnit(product.unit)
    setMinimum(String(product.minimum_stock))
    setPrice(String(product.sale_price ?? 0))
    setPhotoUrl(product.photo_url || '')
    setPhotoFile(null)
    setPhotoPreview(product.photo_url || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const selectPhoto = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Selecione um arquivo de imagem.')
    if (file.size > 5 * 1024 * 1024) return setError('A foto deve ter no máximo 5 MB.')
    setError('')
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const uploadPhoto = async () => {
    if (!photoFile) return photoUrl || null
    const supabase = getSupabaseBrowserClient()
    const extension = photoFile.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `products/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('product-images').upload(path, photoFile, { cacheControl: '3600' })
    if (uploadError) throw uploadError
    return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
  }

  const saveProduct = async (event: FormEvent) => {
    event.preventDefault()
    const numericPrice = Number(price)
    if (!Number.isFinite(numericPrice) || numericPrice < 0) return setError('Informe um preço de venda válido.')
    if (name.trim().length < 2) return setError('Informe o nome do produto.')
    setSavingProduct(true)
    setError('')
    try {
      const supabase = getSupabaseBrowserClient()
      const uploadedPhotoUrl = await uploadPhoto()
      const payload = { name: name.trim(), category: category.trim() || null, unit: unit.trim(), minimum_stock: Number(minimum), sale_price: numericPrice, photo_url: uploadedPhotoUrl }
      const query = editingId ? supabase.from('stock_products').update(payload).eq('id', editingId) : supabase.from('stock_products').insert(payload)
      const { error: productError } = await query
      if (productError) throw productError
      resetProduct()
      await onSaved()
    } catch (caught) {
      setError(getErrorMessage(caught, 'Não foi possível salvar o produto. Verifique se a migração 006 foi aplicada.'))
    } finally {
      setSavingProduct(false)
    }
  }

  const removeProduct = async (product: StockBalance) => {
    const confirmed = window.confirm(`Excluir "${product.name}"? O produto e todo o histórico de movimentações dele serão removidos.`)
    if (!confirmed) return
    const supabase = getSupabaseBrowserClient()
    const { error: removeError } = await supabase.from('stock_products').delete().eq('id', product.id)
    if (removeError) return setError(removeError.code === '23503' ? 'Este produto possui vendas registradas. Inative o produto em vez de excluí-lo.' : removeError.message)
    if (editingId === product.id) resetProduct()
    if (productId === product.id) setProductId('')
    await onSaved()
  }

  const toggleProduct = async (product: StockBalance) => {
    const supabase = getSupabaseBrowserClient()
    const { error: toggleError } = await supabase.from('stock_products').update({ active: !product.active }).eq('id', product.id)
    if (toggleError) return setError(toggleError.message)
    await onSaved()
  }

  const moveStock = async (event: FormEvent) => {
    event.preventDefault()
    const numericQuantity = Number(quantity)
    if (!Number.isInteger(numericQuantity) || numericQuantity <= 0) return setError('Informe uma quantidade inteira maior que zero.')
    setSavingMovement(true)
    setError('')
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.from('stock_movements').insert({ product_id: productId, movement_type: movementType, quantity: numericQuantity, reason: reason.trim() || null })
      if (error) throw error
      setQuantity('1')
      setReason('')
      await onSaved()
    } catch (caught) {
      setError(getErrorMessage(caught, 'Não foi possível registrar a movimentação.'))
    } finally {
      setSavingMovement(false)
    }
  }
  return <div className="admin-stack"><div className="admin-two-columns"><form className="admin-panel admin-form" onSubmit={saveProduct}><div className="panel-heading"><div><span className="eyebrow">{editingId ? 'EDITAR PRODUTO' : 'PRODUTO'}</span><h2>{editingId ? 'Atualizar item' : 'Cadastrar item'}</h2></div>{editingId && <button type="button" className="text-button" onClick={resetProduct}>Cancelar edição</button>}</div><div className="stock-photo-field"><div className="stock-photo-preview">{photoPreview ? <img src={photoPreview} alt="Prévia do produto" /> : <span>▣</span>}</div><div><label className="stock-photo-button">Adicionar foto<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => selectPhoto(event.target.files?.[0])} /></label><small>JPG, PNG, WebP ou GIF. Máximo de 5 MB.</small>{(photoPreview || photoUrl) && <button type="button" className="remove-photo-button" onClick={() => { setPhotoUrl(''); setPhotoFile(null); setPhotoPreview('') }}>Remover foto</button>}</div></div><label>Nome<input value={name} onChange={(event) => setName(event.target.value)} required /></label><div className="form-grid"><label>Categoria<input value={category} onChange={(event) => setCategory(event.target.value)} /></label><label>Unidade<input value={unit} onChange={(event) => setUnit(event.target.value)} required /></label><label>Estoque mínimo<input type="number" min="0" value={minimum} onChange={(event) => setMinimum(event.target.value)} required /></label><label>Preço de venda (R$)<input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0,00" required /></label></div><button className="button button-gold" type="submit" disabled={savingProduct}>{savingProduct ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar produto'}</button></form><form className="admin-panel admin-form" onSubmit={moveStock}><div className="panel-heading"><div><span className="eyebrow">MOVIMENTAÇÃO</span><h2>Entrada ou saída</h2></div></div><label>Produto<select value={productId} onChange={(event) => setProductId(event.target.value)} required><option value="">Selecione</option>{stock.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="form-grid"><label>Tipo<select value={movementType} onChange={(event) => setMovementType(event.target.value as 'entry' | 'exit')}><option value="entry">Entrada</option><option value="exit">Saída</option></select></label><label>Quantidade<input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label></div><label>Motivo<input value={reason} onChange={(event) => setReason(event.target.value)} /></label><button className="button button-gold" type="submit" disabled={savingMovement}>{savingMovement ? 'Registrando...' : 'Registrar movimentação'}</button></form></div><div className="stock-grid">{stock.map((item) => <article key={item.id} className={`${item.current_stock <= item.minimum_stock ? 'stock-card low' : 'stock-card'}${item.active ? '' : ' inactive'}`}><div className="stock-card-photo">{item.photo_url ? <img src={item.photo_url} alt={item.name} /> : <span>{item.name.charAt(0)}</span>}</div><span>{item.category || 'Produto'}</span><h3>{item.name}</h3><strong>{item.current_stock} <small>{item.unit}</small></strong><p>Mínimo: {item.minimum_stock}</p><p className="stock-sale-price">Venda: <strong>{currencyFormatter.format(Number(item.sale_price || 0))}</strong></p><div className="stock-card-actions"><button type="button" className="edit-button" onClick={() => editProduct(item)}>Editar</button><button type="button" className={item.active ? 'toggle active' : 'toggle'} onClick={() => void toggleProduct(item)}>{item.active ? 'Ativo' : 'Inativo'}</button><button type="button" className="delete-button" onClick={() => void removeProduct(item)}>Excluir</button></div></article>)}</div></div>
}

function SettingsView({ settings, setSettings, onSaved, setError }: { settings: SiteSettings; setSettings: (value: SiteSettings) => void; onSaved: () => void; setError: (value: string) => void }) {
  const submit = async (event: FormEvent) => { event.preventDefault(); const supabase = getSupabaseBrowserClient(); const { error } = await supabase.from('site_settings').update({ business_name: settings.business_name, tagline: settings.tagline, whatsapp: settings.whatsapp || null, instagram: settings.instagram || null, address: settings.address || null, logo_url: settings.logo_url || null }).eq('id', 1); if (error) return setError(error.message); onSaved() }
  return <form className="admin-panel admin-form settings-form" onSubmit={submit}><div className="panel-heading"><div><span className="eyebrow">IDENTIDADE DO SITE</span><h2>Informações da barbearia</h2></div></div><div className="form-grid"><label>Nome da barbearia<input value={settings.business_name} onChange={(event) => setSettings({ ...settings, business_name: event.target.value })} required /></label><label>WhatsApp<input value={settings.whatsapp || ''} onChange={(event) => setSettings({ ...settings, whatsapp: event.target.value })} /></label><label className="span-2">Frase principal<input value={settings.tagline} onChange={(event) => setSettings({ ...settings, tagline: event.target.value })} /></label><label>Instagram<input value={settings.instagram || ''} onChange={(event) => setSettings({ ...settings, instagram: event.target.value })} /></label><label>Endereço<input value={settings.address || ''} onChange={(event) => setSettings({ ...settings, address: event.target.value })} /></label><label className="span-2">URL da logo<input type="url" value={settings.logo_url || ''} onChange={(event) => setSettings({ ...settings, logo_url: event.target.value })} placeholder="A logo enviada será configurada aqui" /></label></div><button className="button button-gold" type="submit">Salvar configurações</button></form>
}

function AppointmentRow({ item }: { item: Appointment }) { return <div className="appointment-row"><span className="appointment-time">{new Date(item.starts_at).toLocaleTimeString('pt-BR', { timeZone: 'America/Bahia', hour: '2-digit', minute: '2-digit' })}</span><div><strong>{item.clients?.full_name}</strong><small>{item.services?.name} • {item.barbers?.name}</small></div><span className={`status-badge status-${item.status}`}>{statusLabel[item.status]}</span></div> }
function EmptyState({ text }: { text: string }) { return <div className="empty-state">{text}</div> }
function tabIcon(tab: Tab) { return ({ dashboard: '▦', agenda: '◷', finance: '$', subscribers: '◎', barbers: '♟', services: '✂', plans: '❖', blocks: '⊘', hours: '◔', stock: '▣', admins: '♔', settings: '⚙' } as Record<Tab, string>)[tab] }

function HoursView({ hours, onSaved, setError }: { hours: BusinessHour[]; onSaved: () => Promise<void>; setError: (value: string) => void }) {
  const [draft, setDraft] = useState<BusinessHour[]>(hours)
  const [prevHours, setPrevHours] = useState(hours)
  const [saving, setSaving] = useState(false)

  if (hours !== prevHours) {
    setPrevHours(hours)
    setDraft(hours)
  }

  const update = (day: number, patch: Partial<BusinessHour>) => {
    setDraft((current) => current.map((item) => (item.day_of_week === day ? { ...item, ...patch } : item)))
  }

  const save = async () => {
    for (const item of draft) {
      if (item.active && item.close_time <= item.open_time) {
        return setError(`${dayNames[item.day_of_week]}: o fechamento precisa ser depois da abertura.`)
      }
    }
    setSaving(true)
    setError('')
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.from('business_hours').upsert(
        draft.map((item) => ({
          day_of_week: item.day_of_week,
          open_time: item.open_time,
          close_time: item.close_time,
          slot_minutes: item.slot_minutes,
          active: item.active,
        })),
      )
      if (error) return setError(error.message)
      await onSaved()
    } finally {
      setSaving(false)
    }
  }

  return <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">FUNCIONAMENTO</span><h2>Dias e horários de atendimento</h2></div></div><div className="admin-table-wrap"><table><thead><tr><th>Dia</th><th>Abre</th><th>Fecha</th><th>Intervalo (min)</th><th>Aberto</th></tr></thead><tbody>{draft.map((item) => <tr key={item.day_of_week}><td>{dayNames[item.day_of_week]}</td><td><input type="time" value={item.open_time.slice(0, 5)} onChange={(event) => update(item.day_of_week, { open_time: event.target.value })} /></td><td><input type="time" value={item.close_time.slice(0, 5)} onChange={(event) => update(item.day_of_week, { close_time: event.target.value })} /></td><td><input type="number" min="5" max="120" step="5" value={item.slot_minutes} onChange={(event) => update(item.day_of_week, { slot_minutes: Number(event.target.value) })} /></td><td><button type="button" className={item.active ? 'toggle active' : 'toggle'} onClick={() => update(item.day_of_week, { active: !item.active })}>{item.active ? 'Aberto' : 'Fechado'}</button></td></tr>)}</tbody></table></div><button type="button" className="button button-gold" disabled={saving} onClick={() => void save()}>{saving ? 'Salvando...' : 'Salvar horários'}</button></section>
}

function AdminsView({ setError, onSaved }: { setError: (value: string) => void; onSaved: () => void }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const authHeaders = async () => {
    const supabase = getSupabaseBrowserClient()
    const { data } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${data.session?.access_token ?? ''}`, 'Content-Type': 'application/json' }
  }

  const loadUsers = useCallback(async () => {
    try {
      const headers = await authHeaders()
      setLoadingUsers(true)
      const response = await fetch('/api/admin/users', { headers })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Não foi possível listar os administradores.')
      setUsers((body.users ?? []) as AdminUser[])
    } catch (caught) {
      setError(getErrorMessage(caught, 'Falha ao listar administradores.'))
    } finally {
      setLoadingUsers(false)
    }
  }, [setError])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) void loadUsers() })
    return () => { cancelled = true }
  }, [loadUsers])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ fullName, email, password }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Não foi possível criar o administrador.')
      setFullName('')
      setEmail('')
      setPassword('')
      onSaved()
      await loadUsers()
    } catch (caught) {
      setError(getErrorMessage(caught, 'Falha ao criar administrador.'))
    } finally {
      setSaving(false)
    }
  }

  return <div className="admin-stack"><form className="admin-panel admin-form" onSubmit={submit}><div className="panel-heading"><div><span className="eyebrow">NOVO ACESSO</span><h2>Cadastrar administrador</h2></div></div><div className="form-grid"><label>Nome<input value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={3} /></label><label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label className="span-2">Senha (mín. 8 caracteres)<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" /></label></div><button className="button button-gold" type="submit" disabled={saving}>{saving ? 'Criando...' : 'Criar administrador'}</button></form><section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">EQUIPE DE ACESSO</span><h2>Usuários com perfil</h2></div></div>{loadingUsers ? <div className="loading-card">Carregando usuários...</div> : <div className="block-list">{users.map((user) => <div key={user.id}><div><strong>{user.full_name}</strong><span>{user.role === 'admin' ? 'Administrador' : 'Equipe'}</span><small>Desde {bahiaDateTimeFormatter.format(new Date(user.created_at))}</small></div></div>)}{!users.length && <EmptyState text="Nenhum usuário encontrado." />}</div>}</section></div>
}

function PlansView({ plans, onSaved, setError }: { plans: Plan[]; onSaved: () => Promise<void>; setError: (value: string) => void }) {
  const [editingId, setEditingId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [sortOrder, setSortOrder] = useState('1')

  const reset = () => { setEditingId(''); setName(''); setDescription(''); setPrice(''); setSortOrder('1') }
  const edit = (plan: Plan) => { setEditingId(plan.id); setName(plan.name); setDescription(plan.description || ''); setPrice(String(plan.price)); setSortOrder(String(plan.sort_order)); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const supabase = getSupabaseBrowserClient()
    const payload = { name, description: description || null, price: Number(price), sort_order: Number(sortOrder) }
    const query = editingId ? supabase.from('plans').update(payload).eq('id', editingId) : supabase.from('plans').insert(payload)
    const { error } = await query
    if (error) return setError(error.message.includes('relation') ? 'Execute a migração 002_precos_e_planos.sql no Supabase para habilitar os planos.' : error.message)
    reset()
    await onSaved()
  }
  const toggle = async (plan: Plan) => { const supabase = getSupabaseBrowserClient(); const { error } = await supabase.from('plans').update({ active: !plan.active }).eq('id', plan.id); if (error) return setError(error.message); await onSaved() }

  return <div className="admin-stack"><form className="admin-panel admin-form" onSubmit={submit}><div className="panel-heading"><div><span className="eyebrow">{editingId ? 'EDITAR PLANO' : 'NOVO PLANO'}</span><h2>{editingId ? 'Atualizar plano mensal' : 'Cadastrar plano mensal'}</h2></div>{editingId && <button type="button" className="text-button" onClick={reset}>Cancelar edição</button>}</div><div className="form-grid"><label>Nome<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Preço mensal (R$)<input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required /></label><label>Ordem<input type="number" min="1" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} required /></label><label className="span-2">O que inclui<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Corte + Barba + Sobrancelha" /></label></div><button className="button button-gold" type="submit">{editingId ? 'Salvar alterações' : 'Cadastrar plano'}</button></form><div className="admin-card-grid">{plans.map((plan) => <article className="manage-card service-manage-card" key={plan.id}><div><h3>{plan.name}</h3><p>{plan.description || 'Sem descrição'}</p><small>Ordem {plan.sort_order}</small></div><strong>{currencyFormatter.format(Number(plan.price))}/mês</strong><div className="manage-actions"><button className="edit-button" onClick={() => edit(plan)}>Editar</button><button className={plan.active ? 'toggle active' : 'toggle'} onClick={() => void toggle(plan)}>{plan.active ? 'Ativo' : 'Inativo'}</button></div></article>)}{!plans.length && <EmptyState text="Nenhum plano cadastrado. Execute a migração 002 ou cadastre acima." />}</div></div>
}
