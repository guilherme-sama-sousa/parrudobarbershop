'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookingFlow } from '@/components/booking-flow'
import { Logo } from '@/components/logo'
import { currencyFormatter } from '@/lib/format'
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client'
import type { Barber, Plan, Service, SiteSettings } from '@/lib/types'

const demoSettings: SiteSettings = {
  id: 1,
  business_name: 'Parrudo Barbershop',
  tagline: 'Estilo. Qualidade. Atitude.',
  whatsapp: '5571999999999',
  instagram: '@parrudobarbershop',
  address: null,
  logo_url: null,
}

const demoServices: Service[] = [
  { id: 'demo-corte', name: 'Corte', description: 'Corte na máquina ou navalha.', price: 30, duration_minutes: 30, active: true },
  { id: 'demo-sobrancelha', name: 'Sobrancelha', description: 'Design e acabamento discreto.', price: 10, duration_minutes: 15, active: true },
  { id: 'demo-barba', name: 'Barba', description: 'Modelagem e acabamento.', price: 15, duration_minutes: 20, active: true },
  { id: 'demo-pig-frente', name: 'Pigmentação Frente', description: 'Pigmentação da parte da frente.', price: 10, duration_minutes: 15, active: true },
  { id: 'demo-pig-completa', name: 'Pigmentação Completa', description: 'Pigmentação completa do cabelo.', price: 15, duration_minutes: 20, active: true },
  { id: 'demo-barba-pig', name: 'Barba Pigmentada', description: 'Barba com pigmentação.', price: 25, duration_minutes: 30, active: true },
  { id: 'demo-tesoura', name: 'Corte na Tesoura', description: 'Corte trabalhado inteiro na tesoura.', price: 50, duration_minutes: 45, active: true },
  { id: 'demo-luzes', name: 'Luzes', description: 'Luzes com acabamento profissional.', price: 70, duration_minutes: 90, active: true },
  { id: 'demo-platinado', name: 'Platinado', description: 'Descoloração global platinada.', price: 100, duration_minutes: 120, active: true },
]

const demoBarbers: Barber[] = [
  { id: 'demo-rafael', name: 'Rafael Parrudo', specialties: ['Degradê', 'Barba'], photo_url: null, active: true },
  { id: 'demo-joao', name: 'João Carlos', specialties: ['Social', 'Navalhado'], photo_url: null, active: true },
]

const demoPlans: Plan[] = [
  { id: 'demo-bronze', name: 'Bronze', description: 'Corte (máquina/navalha)', price: 104.99, sort_order: 1, active: true },
  { id: 'demo-prata', name: 'Prata', description: 'Corte + Pigmentação ou Sobrancelha', price: 114.99, sort_order: 2, active: true },
  { id: 'demo-ouro', name: 'Ouro', description: 'Corte + Barba', price: 129.99, sort_order: 3, active: true },
  { id: 'demo-premium', name: 'Premium', description: 'Corte + Barba + Sobrancelha', price: 154.99, sort_order: 4, active: true },
  { id: 'demo-diamante', name: 'Diamante', description: 'Corte + Barba + Sobrancelha + Pigmentação', price: 179.99, sort_order: 5, active: true },
]

export function PublicSite() {
  const configured = isSupabaseConfigured()
  const [settings, setSettings] = useState<SiteSettings>(demoSettings)
  const [services, setServices] = useState<Service[]>(demoServices)
  const [barbers, setBarbers] = useState<Barber[]>(demoBarbers)
  const [plans, setPlans] = useState<Plan[]>(demoPlans)
  const [showPlans, setShowPlans] = useState(false)
  const [loading, setLoading] = useState(configured)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!configured) return

    const load = async () => {
      try {
        const supabase = getSupabaseBrowserClient()
        const [settingsResult, servicesResult, barbersResult, plansResult] = await Promise.all([
          supabase.from('site_settings').select('*').eq('id', 1).single(),
          supabase.from('services').select('*').eq('active', true).order('price'),
          supabase.from('barbers').select('*').eq('active', true).order('name'),
          supabase.from('plans').select('*').eq('active', true).order('sort_order'),
        ])

        if (settingsResult.data) setSettings(settingsResult.data as SiteSettings)
        if (servicesResult.error) throw servicesResult.error
        if (barbersResult.error) throw barbersResult.error
        setServices((servicesResult.data ?? []) as Service[])
        setBarbers((barbersResult.data ?? []) as Barber[])
        // Planos são opcionais: se a migração 002 ainda não rodou, o site segue sem eles.
        setPlans(plansResult.error ? [] : ((plansResult.data ?? []) as Plan[]))
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar os dados.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [configured])

  const whatsappLink = useMemo(() => {
    if (!settings.whatsapp) return null
    const digits = settings.whatsapp.replace(/\D/g, '')
    return digits ? `https://wa.me/${digits}` : null
  }, [settings.whatsapp])

  return (
    <main className="single-shell">
      <header className="single-header">
        <Logo logoUrl={settings.logo_url} compact />
        <div className="single-header-actions">
          {plans.length > 0 && (
            <button type="button" className="button button-outline button-small" onClick={() => setShowPlans(true)}>
              Planos mensais
            </button>
          )}
          {whatsappLink && (
            <a href={whatsappLink} target="_blank" rel="noreferrer" className="button button-gold button-small">
              WhatsApp
            </a>
          )}
        </div>
      </header>

      {!configured && (
        <div className="demo-banner">
          <div className="page-container">
            <strong>Modo de demonstração:</strong> conecte o Supabase para liberar agendamentos reais.
          </div>
        </div>
      )}

      <section className="single-booking" aria-label="Agendamento online">
        {loading ? (
          <div className="loading-card">Carregando agenda...</div>
        ) : (
          <BookingFlow services={services} barbers={barbers} configured={configured} businessName={settings.business_name} />
        )}
      </section>

      {loadError && <div className="floating-alert" role="alert">{loadError}</div>}

      {showPlans && (
        <div className="plans-overlay" role="dialog" aria-modal="true" aria-label="Planos mensais">
          <div className="plans-modal">
            <div className="plans-modal-head">
              <div>
                <span className="eyebrow">PLANO MENSAL</span>
                <h2>Pagamento até o 5º dia útil</h2>
              </div>
              <button type="button" className="plans-close" aria-label="Fechar" onClick={() => setShowPlans(false)}>✕</button>
            </div>
            <div className="plans-list">
              {plans.map((plan) => (
                <article key={plan.id} className="plan-row">
                  <div>
                    <strong>{plan.name}</strong>
                    <span>{plan.description}</span>
                  </div>
                  <b>{currencyFormatter.format(Number(plan.price))}</b>
                </article>
              ))}
            </div>
            {whatsappLink && (
              <a
                href={`${whatsappLink}?text=${encodeURIComponent('Olá! Quero saber mais sobre os planos mensais.')}`}
                target="_blank"
                rel="noreferrer"
                className="button button-gold"
              >
                Assinar pelo WhatsApp
              </a>
            )}
          </div>
        </div>
      )}

      <footer className="single-footer">
        <span>{settings.address || settings.instagram || settings.business_name}</span>
        <a href="/admin/login" className="admin-link">Login do administrador</a>
      </footer>
    </main>
  )
}
