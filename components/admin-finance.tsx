'use client'

import { FormEvent, useMemo, useState } from 'react'
import { bahiaDateFormatter, bahiaDateTimeFormatter, currencyFormatter, maskPhone, normalizePhone, toLocalDateInput } from '@/lib/format'
import { getErrorMessage } from '@/lib/error-message'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Barber, CashMovementType, CashTransaction, Plan, Subscriber, SubscriberPayment } from '@/lib/types'

interface FinanceDataProps {
  cashTransactions: CashTransaction[]
  barbers: Barber[]
  subscribers: Subscriber[]
  subscriberPayments: SubscriberPayment[]
  financeReady: boolean
}

const currentMonth = () => toLocalDateInput().slice(0, 7)

const monthFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function monthLabel(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return 'mês selecionado'
  return monthFormatter.format(new Date(`${value}-01T12:00:00Z`))
}

function shiftMonth(value: string, amount: number) {
  const safeValue = /^\d{4}-\d{2}$/.test(value) ? value : currentMonth()
  const [year, month] = safeValue.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1 + amount, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

function MonthNavigation({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="month-navigation">
    <button type="button" onClick={() => onChange(shiftMonth(value, -1))} aria-label="Ver mês anterior">← Anterior</button>
    <label>Mês<input type="month" value={value} onChange={(event) => onChange(event.target.value)} /></label>
    <button type="button" onClick={() => onChange(shiftMonth(value, 1))} aria-label="Ver próximo mês">Próximo →</button>
  </div>
}

function isSubscriberIncluded(subscriber: Subscriber, month: string) {
  return subscriber.started_on.slice(0, 7) <= month
}

function FinanceMigrationNotice() {
  return <div className="admin-panel finance-migration-notice"><strong>Financeiro ainda não habilitado.</strong><span>Execute as migrações 004, 005 e 006 no Supabase.</span></div>
}

export function FinanceDashboardPanel({ cashTransactions, barbers, subscribers, subscriberPayments, financeReady }: FinanceDataProps) {
  const [month, setMonth] = useState(currentMonth())

  const monthTransactions = useMemo(() => cashTransactions.filter((item) => item.occurred_on.startsWith(month)), [cashTransactions, month])
  const entries = monthTransactions.filter((item) => item.movement_type === 'entry').reduce((sum, item) => sum + Number(item.amount), 0)
  const exits = monthTransactions.filter((item) => item.movement_type === 'exit').reduce((sum, item) => sum + Number(item.amount), 0)
  const eligibleSubscribers = subscribers.filter((item) => item.active && isSubscriberIncluded(item, month))
  const paidSubscriberIds = new Set(subscriberPayments.filter((item) => item.reference_month.startsWith(month)).map((item) => item.subscriber_id))
  const paidCount = eligibleSubscribers.filter((item) => paidSubscriberIds.has(item.id)).length

  const revenueByBarber = barbers
    .filter((barber) => barber.active || monthTransactions.some((item) => item.barber_id === barber.id))
    .map((barber) => ({
      id: barber.id,
      name: barber.name,
      total: monthTransactions
        .filter((item) => item.movement_type === 'entry' && item.barber_id === barber.id)
        .reduce((sum, item) => sum + Number(item.amount), 0),
    }))
    .sort((a, b) => b.total - a.total)
  const largestRevenue = Math.max(...revenueByBarber.map((item) => item.total), 1)

  if (!financeReady) return <FinanceMigrationNotice />

  return <section className="finance-dashboard admin-stack">
    <div className="finance-section-heading"><div><span className="eyebrow">VISÃO FINANCEIRA</span><h2>Resumo de {monthLabel(month)}</h2></div><MonthNavigation value={month} onChange={setMonth} /></div>
    <div className="admin-stats finance-stats">
      <article><span>Entradas</span><strong>{currencyFormatter.format(entries)}</strong><small>valores recebidos no mês</small></article>
      <article className="finance-exit-card"><span>Saídas</span><strong>{currencyFormatter.format(exits)}</strong><small>despesas lançadas no mês</small></article>
      <article className={entries - exits < 0 ? 'finance-negative-card' : ''}><span>Saldo</span><strong>{currencyFormatter.format(entries - exits)}</strong><small>entradas menos saídas</small></article>
      <article><span>Mensalistas</span><strong>{paidCount}/{eligibleSubscribers.length}</strong><small>{eligibleSubscribers.length - paidCount} pagamento(s) pendente(s)</small></article>
    </div>
    <div className="admin-two-columns">
      <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">FATURAMENTO</span><h2>Entradas por barbeiro</h2></div></div><p className="panel-description">Baseado nas entradas do Financeiro vinculadas a cada profissional.</p><div className="barber-revenue-list">{revenueByBarber.map((barber) => <div className="barber-revenue-row" key={barber.id}><div><strong>{barber.name}</strong><span>{currencyFormatter.format(barber.total)}</span></div><div className="barber-revenue-track"><span style={{ width: `${(barber.total / largestRevenue) * 100}%` }} /></div></div>)}{!revenueByBarber.length && <EmptyFinanceState text="Cadastre um barbeiro para acompanhar o faturamento." />}</div></section>
      <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">ASSINANTES</span><h2>Mensalidades</h2></div></div><div className="subscriber-dashboard-summary"><div><strong>{eligibleSubscribers.length}</strong><span>assinantes ativos</span></div><div className="paid"><strong>{paidCount}</strong><span>pagos</span></div><div className={eligibleSubscribers.length - paidCount ? 'pending' : ''}><strong>{eligibleSubscribers.length - paidCount}</strong><span>pendentes</span></div></div>{!eligibleSubscribers.length && <EmptyFinanceState text="Nenhum assinante ativo neste mês." />}</section>
    </div>
  </section>
}

interface CashFlowViewProps {
  cashTransactions: CashTransaction[]
  barbers: Barber[]
  financeReady: boolean
  onSaved: () => Promise<void>
  setError: (value: string) => void
}

export function CashFlowView({ cashTransactions, barbers, financeReady, onSaved, setError }: CashFlowViewProps) {
  const [movementType, setMovementType] = useState<CashMovementType>('entry')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [barberId, setBarberId] = useState('')
  const [occurredOn, setOccurredOn] = useState(toLocalDateInput())
  const [month, setMonth] = useState(currentMonth())
  const [barberFilter, setBarberFilter] = useState('all')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')

  const monthTransactions = cashTransactions.filter((item) => item.occurred_on.startsWith(month))
  const revenueByBarber = barbers
    .filter((barber) => barber.active || monthTransactions.some((item) => item.barber_id === barber.id))
    .map((barber) => ({
      id: barber.id,
      name: barber.name,
      total: monthTransactions
        .filter((item) => item.movement_type === 'entry' && item.barber_id === barber.id)
        .reduce((sum, item) => sum + Number(item.amount), 0),
    }))
    .sort((a, b) => b.total - a.total)
  const unassignedRevenue = monthTransactions
    .filter((item) => item.movement_type === 'entry' && !item.barber_id)
    .reduce((sum, item) => sum + Number(item.amount), 0)
  const filteredTransactions = monthTransactions.filter((item) => {
    if (barberFilter === 'all') return true
    if (barberFilter === 'unassigned') return !item.barber_id
    return item.barber_id === barberFilter
  })
  const entries = filteredTransactions.filter((item) => item.movement_type === 'entry').reduce((sum, item) => sum + Number(item.amount), 0)
  const exits = filteredTransactions.filter((item) => item.movement_type === 'exit').reduce((sum, item) => sum + Number(item.amount), 0)
  const selectedBarberLabel = barberFilter === 'all' ? 'Todos os barbeiros' : barberFilter === 'unassigned' ? 'Sem barbeiro' : barbers.find((item) => item.id === barberFilter)?.name || 'Barbeiro'

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError('Informe um valor maior que zero.')
    setSaving(true)
    setError('')
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.from('cash_transactions').insert({
        movement_type: movementType,
        amount: numericAmount,
        description: description.trim(),
        barber_id: barberId || null,
        occurred_on: occurredOn,
      })
      if (error) throw error
      setAmount('')
      setDescription('')
      setBarberId('')
      await onSaved()
    } catch (caught) {
      setError(getErrorMessage(caught, 'Não foi possível registrar o lançamento.'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (transaction: CashTransaction) => {
    if (!window.confirm(`Excluir o lançamento "${transaction.description}"?`)) return
    setDeletingId(transaction.id)
    setError('')
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.from('cash_transactions').delete().eq('id', transaction.id)
      if (error) throw error
      await onSaved()
    } catch (caught) {
      const code = typeof caught === 'object' && caught && 'code' in caught ? String(caught.code) : ''
      setError(code === '23503' ? 'Este lançamento foi gerado automaticamente. Exclua a venda no modal de Vendas ou reabra a mensalidade no menu Assinantes.' : getErrorMessage(caught, 'Não foi possível excluir o lançamento.'))
    } finally {
      setDeletingId('')
    }
  }

  if (!financeReady) return <FinanceMigrationNotice />

  return <div className="admin-stack">
    <div className="admin-two-columns finance-entry-layout">
      <form className="admin-panel admin-form" onSubmit={submit}><div className="panel-heading"><div><span className="eyebrow">NOVO LANÇAMENTO</span><h2>Registrar entrada ou saída</h2></div></div><div className="finance-type-switch"><button type="button" className={movementType === 'entry' ? 'active entry' : ''} onClick={() => setMovementType('entry')}>＋ Entrada</button><button type="button" className={movementType === 'exit' ? 'active exit' : ''} onClick={() => setMovementType('exit')}>− Saída</button></div><div className="form-grid"><label>Valor (R$)<input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="35,00" required /></label><label>Data<input type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} required /></label><label className="span-2">Descrição<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={movementType === 'entry' ? 'Ex.: Corte' : 'Ex.: Compra de gilete'} minLength={2} required /></label><label className="span-2">Barbeiro (opcional)<select value={barberId} onChange={(event) => setBarberId(event.target.value)}><option value="">Sem barbeiro vinculado</option>{barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.name}</option>)}</select><small>Vincule as entradas para aparecerem no faturamento por barbeiro.</small></label></div><button className="button button-gold" type="submit" disabled={saving}>{saving ? 'Registrando...' : 'Registrar lançamento'}</button></form>
      <section className="admin-panel"><div className="finance-section-heading compact"><div><span className="eyebrow">RESUMO DO CAIXA</span><h2>{monthLabel(month)}</h2></div><MonthNavigation value={month} onChange={setMonth} /></div><p className="finance-filter-caption">Exibindo: <strong>{selectedBarberLabel}</strong></p><div className="cash-summary"><div className="entry"><span>Entradas</span><strong>{currencyFormatter.format(entries)}</strong></div><div className="exit"><span>Saídas</span><strong>{currencyFormatter.format(exits)}</strong></div><div className={entries - exits < 0 ? 'balance negative' : 'balance'}><span>Saldo</span><strong>{currencyFormatter.format(entries - exits)}</strong></div></div></section>
    </div>
    <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">FATURAMENTO POR BARBEIRO</span><h2>Separação de {monthLabel(month)}</h2></div></div><p className="panel-description">Escolha um profissional para filtrar os totais e o histórico de movimentações.</p><div className="barber-finance-filter"><button type="button" className={barberFilter === 'all' ? 'active' : ''} onClick={() => setBarberFilter('all')}><span>Todos</span><strong>{currencyFormatter.format(monthTransactions.filter((item) => item.movement_type === 'entry').reduce((sum, item) => sum + Number(item.amount), 0))}</strong><small>faturamento total</small></button>{revenueByBarber.map((barber) => <button type="button" className={barberFilter === barber.id ? 'active' : ''} key={barber.id} onClick={() => setBarberFilter(barber.id)}><span>{barber.name}</span><strong>{currencyFormatter.format(barber.total)}</strong><small>entradas vinculadas</small></button>)}<button type="button" className={barberFilter === 'unassigned' ? 'active warning' : 'warning'} onClick={() => setBarberFilter('unassigned')}><span>Sem barbeiro</span><strong>{currencyFormatter.format(unassignedRevenue)}</strong><small>entradas não vinculadas</small></button></div></section>
    <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">MOVIMENTAÇÕES</span><h2>{selectedBarberLabel} • {monthLabel(month)}</h2></div></div><div className="finance-ledger">{filteredTransactions.map((item) => <div className="finance-ledger-row" key={item.id}><span className={item.movement_type === 'entry' ? 'movement-badge entry' : 'movement-badge exit'}>{item.movement_type === 'entry' ? 'Entrada' : 'Saída'}</span><div><strong>{item.description}</strong><small>{bahiaDateFormatter.format(new Date(`${item.occurred_on}T12:00:00-03:00`))}{item.barbers?.name ? ` • ${item.barbers.name}` : ' • Sem barbeiro'}</small></div><strong className={item.movement_type === 'entry' ? 'money-entry' : 'money-exit'}>{item.movement_type === 'entry' ? '+' : '−'} {currencyFormatter.format(Number(item.amount))}</strong><button type="button" className="finance-delete-button" onClick={() => void remove(item)} disabled={deletingId === item.id}>{deletingId === item.id ? 'Excluindo...' : 'Excluir'}</button></div>)}{!filteredTransactions.length && <EmptyFinanceState text="Nenhum lançamento para este filtro e mês." />}</div></section>
  </div>
}

interface SubscribersViewProps {
  subscribers: Subscriber[]
  subscriberPayments: SubscriberPayment[]
  plans: Plan[]
  barbers: Barber[]
  financeReady: boolean
  onSaved: () => Promise<void>
  setError: (value: string) => void
}

export function SubscribersView({ subscribers, subscriberPayments, plans, barbers, financeReady, onSaved, setError }: SubscribersViewProps) {
  const [editingId, setEditingId] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [planId, setPlanId] = useState('')
  const [barberId, setBarberId] = useState('')
  const [month, setMonth] = useState(currentMonth())
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [paymentActionId, setPaymentActionId] = useState('')

  const reset = () => { setEditingId(''); setFullName(''); setPhone(''); setPlanId(''); setBarberId('') }
  const edit = (subscriber: Subscriber) => { setEditingId(subscriber.id); setFullName(subscriber.full_name); setPhone(maskPhone(subscriber.phone)); setPlanId(subscriber.plan_id || ''); setBarberId(subscriber.barber_id || ''); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR')
  const searchPhone = normalizePhone(search)
  const visibleSubscribers = subscribers.filter((subscriber) => {
    if (!normalizedSearch) return true
    return subscriber.full_name.toLocaleLowerCase('pt-BR').includes(normalizedSearch) || Boolean(searchPhone && subscriber.phone.includes(searchPhone))
  })
  const paymentsForMonth = subscriberPayments.filter((payment) => payment.reference_month.startsWith(month))
  const paymentBySubscriber = new Map(paymentsForMonth.map((payment) => [payment.subscriber_id, payment]))
  const eligibleSubscribers = subscribers.filter((subscriber) => subscriber.active && isSubscriberIncluded(subscriber, month))
  const paidCount = eligibleSubscribers.filter((subscriber) => paymentBySubscriber.has(subscriber.id)).length

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const cleanPhone = normalizePhone(phone)
    if (fullName.trim().length < 3) return setError('Informe o nome do assinante.')
    if (cleanPhone.length < 10 || cleanPhone.length > 13) return setError('Informe um telefone válido com DDD.')
    if (!planId) return setError('Selecione o plano mensal do assinante.')
    if (!barberId) return setError('Selecione o barbeiro responsável pelo assinante.')
    setSaving(true)
    setError('')
    try {
      const supabase = getSupabaseBrowserClient()
      const payload = { full_name: fullName.trim(), phone: cleanPhone, plan_id: planId, barber_id: barberId }
      const query = editingId ? supabase.from('subscribers').update(payload).eq('id', editingId) : supabase.from('subscribers').insert(payload)
      const { error } = await query
      if (error) throw error
      reset()
      await onSaved()
    } catch (caught) {
      const message = getErrorMessage(caught, 'Não foi possível salvar o assinante.')
      setError(message.includes('duplicate') || message.includes('unique') ? 'Já existe um assinante com este telefone.' : message)
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (subscriber: Subscriber) => {
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.from('subscribers').update({ active: !subscriber.active }).eq('id', subscriber.id)
    if (error) return setError(error.message)
    await onSaved()
  }

  const removeSubscriber = async (subscriber: Subscriber) => {
    if (!window.confirm(`Excluir permanentemente ${subscriber.full_name} e o histórico de pagamentos? As entradas já registradas no caixa serão preservadas.`)) return
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.from('subscribers').delete().eq('id', subscriber.id)
    if (error) return setError(error.message)
    if (editingId === subscriber.id) reset()
    await onSaved()
  }

  const markPaid = async (subscriber: Subscriber) => {
    if (!/^\d{4}-\d{2}$/.test(month)) return setError('Selecione o mês do pagamento.')
    if (!subscriber.plan_id) return setError('Edite o assinante e selecione um plano antes de dar baixa.')
    if (!subscriber.barber_id) return setError('Edite o assinante e selecione o barbeiro responsável antes de dar baixa.')
    setPaymentActionId(subscriber.id)
    setError('')
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.rpc('mark_subscriber_payment', { p_subscriber_id: subscriber.id, p_reference_month: `${month}-01`, p_paid_on: toLocalDateInput() })
      if (error) throw error
      await onSaved()
    } catch (caught) {
      setError(getErrorMessage(caught, 'Não foi possível dar baixa na mensalidade.'))
    } finally {
      setPaymentActionId('')
    }
  }

  const reopenMonth = async (payment: SubscriberPayment) => {
    if (!window.confirm('Reabrir este pagamento? A entrada automática também será removida do caixa.')) return
    setPaymentActionId(payment.subscriber_id)
    setError('')
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.rpc('reopen_subscriber_payment', { p_payment_id: payment.id })
      if (error) throw error
      await onSaved()
    } catch (caught) {
      setError(getErrorMessage(caught, 'Não foi possível reabrir a mensalidade.'))
    } finally {
      setPaymentActionId('')
    }
  }

  if (!financeReady) return <FinanceMigrationNotice />

  return <div className="admin-stack">
    <div className="admin-two-columns subscriber-top-layout"><form className="admin-panel admin-form" onSubmit={submit}><div className="panel-heading"><div><span className="eyebrow">{editingId ? 'EDITAR ASSINANTE' : 'NOVO ASSINANTE'}</span><h2>{editingId ? 'Atualizar cadastro' : 'Adicionar mensalista'}</h2></div>{editingId && <button type="button" className="text-button" onClick={reset}>Cancelar edição</button>}</div><label>Nome<input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nome do assinante" minLength={3} required /></label><label>Telefone / WhatsApp<input value={phone} onChange={(event) => setPhone(maskPhone(event.target.value))} placeholder="(71) 99999-9999" required /></label><label>Plano mensal<select value={planId} onChange={(event) => setPlanId(event.target.value)} required><option value="">Selecione um plano</option>{plans.filter((plan) => plan.active || plan.id === planId).map((plan) => <option key={plan.id} value={plan.id}>{plan.name} — {currencyFormatter.format(Number(plan.price))}/mês</option>)}</select><small>Os planos são cadastrados e editados no menu Planos.</small></label><label>Barbeiro responsável<select value={barberId} onChange={(event) => setBarberId(event.target.value)} required><option value="">Selecione um barbeiro</option>{barbers.filter((barber) => barber.active || barber.id === barberId).map((barber) => <option key={barber.id} value={barber.id}>{barber.name}{barber.active ? '' : ' (inativo)'}</option>)}</select><small>A mensalidade será lançada no faturamento deste barbeiro.</small></label><button className="button button-gold" type="submit" disabled={saving || !plans.length || !barbers.some((barber) => barber.active)}>{saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Adicionar assinante'}</button>{!plans.length && <p className="form-warning">Nenhum plano disponível. Cadastre ou ative um plano primeiro.</p>}{!barbers.some((barber) => barber.active) && <p className="form-warning">Nenhum barbeiro ativo. Cadastre ou ative um profissional primeiro.</p>}</form><section className="admin-panel"><div className="finance-section-heading compact"><div><span className="eyebrow">PAGAMENTOS</span><h2>{monthLabel(month)}</h2></div><MonthNavigation value={month} onChange={setMonth} /></div><div className="subscriber-dashboard-summary large"><div><strong>{eligibleSubscribers.length}</strong><span>ativos</span></div><div className="paid"><strong>{paidCount}</strong><span>pagos</span></div><div className={eligibleSubscribers.length - paidCount ? 'pending' : ''}><strong>{eligibleSubscribers.length - paidCount}</strong><span>pendentes</span></div></div><p className="panel-description">Use Anterior e Próximo para consultar inclusive meses futuros. Ao dar baixa, o valor do plano entra automaticamente no Financeiro e no faturamento do barbeiro responsável. Reabrir o mês remove essa entrada.</p></section></div>
    <section className="admin-panel"><div className="panel-heading subscriber-list-heading"><div><span className="eyebrow">ACOMPANHAMENTO</span><h2>Assinantes mensais</h2></div><input className="subscriber-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome ou telefone" aria-label="Buscar assinante por nome ou telefone" /></div><div className="subscriber-grid">{visibleSubscribers.map((subscriber) => { const payment = paymentBySubscriber.get(subscriber.id); const notStarted = !isSubscriberIncluded(subscriber, month); const paymentBusy = paymentActionId === subscriber.id; return <article className={!subscriber.active ? 'subscriber-card inactive' : 'subscriber-card'} key={subscriber.id}><div className="subscriber-card-main"><div className="subscriber-avatar">{subscriber.full_name.charAt(0).toUpperCase()}</div><div><h3>{subscriber.full_name}</h3><a href={`https://wa.me/55${subscriber.phone}`} target="_blank" rel="noreferrer">{maskPhone(subscriber.phone)}</a><span className={subscriber.plans ? 'subscriber-plan' : 'subscriber-plan missing'}>{subscriber.plans ? `${subscriber.plans.name} • ${currencyFormatter.format(Number(subscriber.plans.price))}/mês` : 'Plano não definido'}</span><span className={subscriber.barbers ? 'subscriber-barber' : 'subscriber-barber missing'}>{subscriber.barbers ? `Barbeiro: ${subscriber.barbers.name}` : 'Barbeiro não definido'}</span><small>Desde {bahiaDateFormatter.format(new Date(`${subscriber.started_on}T12:00:00-03:00`))}</small></div></div><div className="subscriber-payment-status">{!subscriber.active ? <span className="inactive">Inativo</span> : notStarted ? <span>Ainda não assinava</span> : payment ? <><span className="paid">Pago</span><small>{currencyFormatter.format(Number(payment.amount || subscriber.plans?.price || 0))} • baixa em {bahiaDateTimeFormatter.format(new Date(payment.paid_at))}</small></> : !subscriber.plan_id ? <span className="missing-plan">Selecione um plano</span> : !subscriber.barber_id ? <span className="missing-plan">Selecione o barbeiro</span> : <span className="pending">Pagamento pendente</span>}</div><div className="subscriber-actions"><button type="button" className="edit-button" onClick={() => edit(subscriber)}>Editar</button><button type="button" className={subscriber.active ? 'toggle active' : 'toggle'} onClick={() => void toggle(subscriber)}>{subscriber.active ? 'Ativo' : 'Inativo'}</button><button type="button" className="subscriber-delete-button" onClick={() => void removeSubscriber(subscriber)}>Excluir</button>{subscriber.active && !notStarted && (payment ? <button type="button" className="reopen-payment-button" onClick={() => void reopenMonth(payment)} disabled={paymentBusy}>{paymentBusy ? 'Reabrindo...' : 'Reabrir mês'}</button> : subscriber.plan_id && subscriber.barber_id ? <button type="button" className="pay-button" onClick={() => void markPaid(subscriber)} disabled={paymentBusy}>{paymentBusy ? 'Dando baixa...' : 'Dar baixa'}</button> : null)}</div></article>})}{!visibleSubscribers.length && <EmptyFinanceState text="Nenhum assinante encontrado." />}</div></section>
  </div>
}

function EmptyFinanceState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>
}
