'use client'

import { useMemo, useState } from 'react'
import { groupAvailableSlots } from '@/lib/booking-utils.mjs'
import { getErrorMessage } from '@/lib/error-message'
import { bahiaTimeFormatter, currencyFormatter, toLocalDateInput } from '@/lib/format'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { AvailableSlot, Barber, Service } from '@/lib/types'

interface BookingFlowProps {
  services: Service[]
  barbers: Barber[]
  configured: boolean
  businessName: string
  clientName: string
  onBooked?: () => Promise<void> | void
}

type Step = 1 | 2 | 3 | 4

const stepLabels = ['Serviço', 'Profissional', 'Horário', 'Confirmar']

export function BookingFlow({ services, barbers, configured, businessName, clientName, onBooked }: BookingFlowProps) {
  const [step, setStep] = useState<Step>(1)
  const [serviceId, setServiceId] = useState('')
  const [barberId, setBarberId] = useState('')
  const [date, setDate] = useState(toLocalDateInput())
  const [slots, setSlots] = useState<AvailableSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successId, setSuccessId] = useState('')

  const service = services.find((item) => item.id === serviceId)
  const selectedBarber = barbers.find((item) => item.id === selectedSlot?.barber_id)
  const groupedSlots = useMemo(
    () => groupAvailableSlots(slots, (value) => bahiaTimeFormatter.format(new Date(value))),
    [slots],
  )

  const loadSlots = async (targetDate = date) => {
    setLoadingSlots(true)
    setError('')
    setSelectedSlot(null)

    try {
      if (!configured) {
        const mockBarber = barberId || barbers[0]?.id || 'demo-barber'
        const mockName = barbers.find((item) => item.id === mockBarber)?.name || 'Profissional disponível'
        const mock = ['09:00', '09:30', '10:30', '11:00', '14:00', '15:30', '17:00', '18:00'].map((time) => ({
          slot_start: `${targetDate}T${time}:00-03:00`,
          barber_id: mockBarber,
          barber_name: mockName,
        }))
        setSlots(mock)
        return
      }

      const supabase = getSupabaseBrowserClient()
      const { data, error: rpcError } = await supabase.rpc('get_available_slots', {
        p_date: targetDate,
        p_service_id: serviceId,
        p_barber_id: barberId || null,
      })
      if (rpcError) throw rpcError
      setSlots((data ?? []) as AvailableSlot[])
    } catch (caught) {
      setSlots([])
      setError(getErrorMessage(caught, 'Não foi possível consultar os horários.'))
    } finally {
      setLoadingSlots(false)
    }
  }

  const submitBooking = async () => {
    if (!serviceId || !selectedSlot) {
      setError('Revise os dados do agendamento.')
      return
    }

    if (!configured) {
      setSuccessId('DEMONSTRACAO')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error: rpcError } = await supabase.rpc('create_client_appointment', {
        p_service_id: serviceId,
        p_barber_id: selectedSlot.barber_id,
        p_starts_at: selectedSlot.slot_start,
      })
      if (rpcError) throw rpcError
      setSuccessId(String(data))
      await onBooked?.()
    } catch (caught) {
      setError(getErrorMessage(caught, 'Não foi possível concluir o agendamento.'))
      await loadSlots()
      setStep(3)
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setStep(1)
    setServiceId('')
    setBarberId('')
    setSelectedSlot(null)
    setSlots([])
    setSuccessId('')
    setError('')
  }

  if (successId) {
    return (
      <div className="booking-card booking-success">
        <span className="success-icon">✓</span>
        <span className="eyebrow">AGENDAMENTO CONFIRMADO</span>
        <h3>Te esperamos, {clientName.split(' ')[0]}.</h3>
        <p>{service?.name} com {selectedBarber?.name || selectedSlot?.barber_name}, às {selectedSlot && bahiaTimeFormatter.format(new Date(selectedSlot.slot_start))}.</p>
        <small>{configured ? `Código: ${successId.slice(0, 8).toUpperCase()}` : 'Demonstração: nenhum dado foi salvo.'}</small>
        <button type="button" className="button button-gold" onClick={reset}>Fazer outro agendamento</button>
      </div>
    )
  }

  return (
    <div className="booking-card">
      <div className="booking-progress booking-progress-client" aria-label={`Etapa ${step} de 4`}>
        {stepLabels.map((label, index) => (
          <div key={label} className={step > index ? 'active' : ''} aria-current={step === index + 1 ? 'step' : undefined}>
            <span>{step > index + 1 ? '✓' : index + 1}</span>
            <small>{label}</small>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="form-step">
          <div className="form-title"><span>01</span><div><h3>Escolha o serviço</h3><p>Selecione o cuidado ideal para hoje.</p></div></div>
          <div className="choice-list">
            {services.map((item) => (
              <button key={item.id} type="button" className={serviceId === item.id ? 'choice-card selected' : 'choice-card'} onClick={() => setServiceId(item.id)}>
                <div><strong>{item.name}</strong><small>{item.duration_minutes} minutos</small></div>
                <b>{currencyFormatter.format(Number(item.price))}</b>
              </button>
            ))}
            {!services.length && <p className="empty-message">Nenhum serviço disponível no momento.</p>}
          </div>
          <div className="form-actions form-actions-next"><button type="button" className="button button-gold" disabled={!serviceId} onClick={() => setStep(2)}>Continuar →</button></div>
        </div>
      )}

      {step === 2 && (
        <div className="form-step">
          <div className="form-title"><span>02</span><div><h3>Escolha o profissional</h3><p>Você também pode deixar a escolha por nossa conta.</p></div></div>
          <div className="choice-list">
            <button type="button" className={!barberId ? 'choice-card selected' : 'choice-card'} onClick={() => setBarberId('')}><div><strong>Primeiro disponível</strong><small>Encontra a melhor opção automaticamente</small></div><b>⚡</b></button>
            {barbers.map((barber) => (
              <button key={barber.id} type="button" className={barberId === barber.id ? 'choice-card selected choice-professional' : 'choice-card choice-professional'} onClick={() => setBarberId(barber.id)}>
                <span className="choice-avatar">{barber.photo_url ? <img src={barber.photo_url} alt="" /> : barber.name.charAt(0)}</span>
                <div><strong>{barber.name}</strong><small>{barber.specialties.join(' • ') || 'Profissional da equipe'}</small></div><b>›</b>
              </button>
            ))}
          </div>
          <div className="form-actions"><button type="button" className="button button-ghost" onClick={() => setStep(1)}>Voltar</button><button type="button" className="button button-gold" onClick={() => { setStep(3); void loadSlots() }}>Ver horários →</button></div>
        </div>
      )}

      {step === 3 && (
        <div className="form-step">
          <div className="form-title"><span>03</span><div><h3>Escolha data e horário</h3><p>Apenas horários realmente livres são exibidos.</p></div></div>
          <label>Data<input type="date" min={toLocalDateInput()} value={date} onChange={(event) => { const value = event.target.value; setDate(value); if (value) void loadSlots(value) }} /></label>
          <button type="button" className="text-button" onClick={() => void loadSlots()}>Atualizar horários</button>
          {loadingSlots ? <div className="loading-card">Consultando agenda...</div> : (
            <div className="slot-grid">
              {groupedSlots.map((slot) => <button type="button" key={`${slot.slot_start}-${slot.barber_id}`} className={selectedSlot?.slot_start === slot.slot_start && selectedSlot?.barber_id === slot.barber_id ? 'slot selected' : 'slot'} onClick={() => setSelectedSlot(slot)}>{slot.label}</button>)}
              {!groupedSlots.length && <p className="empty-message">Nenhum horário disponível para esta data.</p>}
            </div>
          )}
          <div className="form-actions"><button type="button" className="button button-ghost" onClick={() => setStep(2)}>Voltar</button><button type="button" className="button button-gold" disabled={!selectedSlot} onClick={() => setStep(4)}>Revisar →</button></div>
        </div>
      )}

      {step === 4 && (
        <div className="form-step">
          <div className="form-title"><span>04</span><div><h3>Confirme seu horário</h3><p>Revise antes de concluir.</p></div></div>
          <div className="booking-summary">
            <div><span>Cliente</span><strong>{clientName}</strong></div>
            <div><span>Serviço</span><strong>{service?.name}</strong></div>
            <div><span>Profissional</span><strong>{selectedBarber?.name || selectedSlot?.barber_name}</strong></div>
            <div><span>Horário</span><strong>{selectedSlot && new Date(selectedSlot.slot_start).toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' })} às {selectedSlot && bahiaTimeFormatter.format(new Date(selectedSlot.slot_start))}</strong></div>
            <div className="summary-total"><span>Total</span><strong>{service && currencyFormatter.format(Number(service.price))}</strong></div>
          </div>
          <p className="privacy-note">Ao confirmar, você autoriza {businessName} a usar seus dados somente para tratar do agendamento.</p>
          <div className="form-actions"><button type="button" className="button button-ghost" onClick={() => setStep(3)}>Voltar</button><button type="button" className="button button-gold" disabled={submitting} onClick={() => void submitBooking()}>{submitting ? 'Confirmando...' : 'Confirmar agendamento'}</button></div>
        </div>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  )
}
