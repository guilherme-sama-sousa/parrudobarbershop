'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookingFlow } from '@/components/booking-flow'
import { Logo } from '@/components/logo'
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client'
import type { Barber, Service, SiteSettings } from '@/lib/types'

const demoSettings: SiteSettings = {
  id: 1,
  business_name: 'Parrudo Barbershop',
  tagline: 'Corte preciso. Barba alinhada. Presença de verdade.',
  whatsapp: '5571999999999',
  instagram: '@parrudobarbershop',
  address: null,
  logo_url: null,
}

const demoServices: Service[] = [
  { id: 'demo-corte', name: 'Corte', description: 'Social, degradê ou navalhado.', price: 35, duration_minutes: 30, active: true },
  { id: 'demo-barba', name: 'Barba', description: 'Modelagem, acabamento e toalha quente.', price: 25, duration_minutes: 30, active: true },
  { id: 'demo-sobrancelha', name: 'Sobrancelha', description: 'Design e acabamento discreto.', price: 15, duration_minutes: 15, active: true },
  { id: 'demo-combo', name: 'Corte e Barba', description: 'O combo completo da casa.', price: 55, duration_minutes: 60, active: true },
]

const demoBarbers: Barber[] = [
  { id: 'demo-rafael', name: 'Rafael Parrudo', specialties: ['Degradê', 'Barba'], photo_url: null, active: true },
  { id: 'demo-joao', name: 'João Carlos', specialties: ['Social', 'Navalhado'], photo_url: null, active: true },
]

export function PublicSite() {
  const configured = isSupabaseConfigured()
  const [settings, setSettings] = useState<SiteSettings>(demoSettings)
  const [services, setServices] = useState<Service[]>(demoServices)
  const [barbers, setBarbers] = useState<Barber[]>(demoBarbers)
  const [loading, setLoading] = useState(configured)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!configured) return

    const load = async () => {
      try {
        const supabase = getSupabaseBrowserClient()
        const [settingsResult, servicesResult, barbersResult] = await Promise.all([
          supabase.from('site_settings').select('*').eq('id', 1).single(),
          supabase.from('services').select('*').eq('active', true).order('price'),
          supabase.from('barbers').select('*').eq('active', true).order('name'),
        ])

        if (settingsResult.data) setSettings(settingsResult.data as SiteSettings)
        if (servicesResult.error) throw servicesResult.error
        if (barbersResult.error) throw barbersResult.error
        setServices((servicesResult.data ?? []) as Service[])
        setBarbers((barbersResult.data ?? []) as Barber[])
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
        {whatsappLink && (
          <a href={whatsappLink} target="_blank" rel="noreferrer" className="button button-outline button-small">
            WhatsApp
          </a>
        )}
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

      <footer className="single-footer">
        <span>{settings.address || settings.instagram || settings.business_name}</span>
        <a href="/admin/login" className="admin-link">Login do administrador</a>
      </footer>
    </main>
  )
}
