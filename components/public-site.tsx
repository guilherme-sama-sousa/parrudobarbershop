'use client'

import { useEffect, useState } from 'react'
import { ClientPortal } from '@/components/client-portal'
import { Logo } from '@/components/logo'
import { getErrorMessage } from '@/lib/error-message'
import { getSupabaseBrowserClient, getSupabaseConfigStatus } from '@/lib/supabase/client'
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
  const configStatus = getSupabaseConfigStatus()
  const configured = configStatus === 'ok'
  const [settings, setSettings] = useState<SiteSettings>(demoSettings)
  const [services, setServices] = useState<Service[]>(() => configured ? [] : demoServices)
  const [barbers, setBarbers] = useState<Barber[]>(() => configured ? [] : demoBarbers)
  const [plans, setPlans] = useState<Plan[]>(() => configured ? [] : demoPlans)
  const [loading, setLoading] = useState(configured)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!configured) return

    const load = async () => {
      try {
        setLoadError('')
        const supabase = getSupabaseBrowserClient()
        const [settingsResult, servicesResult, barbersResult, plansResult] = await Promise.all([
          supabase.from('site_settings').select('*').eq('id', 1).maybeSingle(),
          supabase.from('services').select('*').eq('active', true).order('price'),
          supabase.from('barbers').select('*').eq('active', true).order('name'),
          supabase.from('plans').select('*').eq('active', true).order('sort_order'),
        ])

        if (settingsResult.data) setSettings(settingsResult.data as SiteSettings)
        setServices(servicesResult.error ? [] : ((servicesResult.data ?? []) as Service[]))
        setBarbers(barbersResult.error ? [] : ((barbersResult.data ?? []) as Barber[]))
        setPlans(plansResult.error ? [] : ((plansResult.data ?? []) as Plan[]))

        const firstError = settingsResult.error || servicesResult.error || barbersResult.error || plansResult.error
        if (firstError) throw firstError
      } catch (caught) {
        // Em produção, nunca mantenha IDs fictícios: as funções SQL esperam UUIDs reais.
        setServices((current) => current.filter((item) => !item.id.startsWith('demo-')))
        setBarbers((current) => current.filter((item) => !item.id.startsWith('demo-')))
        setPlans((current) => current.filter((item) => !item.id.startsWith('demo-')))
        setLoadError(getErrorMessage(caught, 'Não foi possível carregar os dados da barbearia.'))
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [configured])

  if (loading) return <main className="client-auth-shell"><div className="client-auth-card client-auth-loading"><Logo logoUrl={settings.logo_url} /><span>Carregando Parrudo...</span></div></main>

  const configurationError = configStatus === 'missing'
    ? 'Modo de demonstração: configure o Supabase para liberar cadastros e agendamentos reais.'
    : configStatus === 'invalid_url'
      ? 'A variável NEXT_PUBLIC_SUPABASE_URL não contém uma URL válida. Corrija o valor na hospedagem e publique novamente.'
      : loadError

  return <ClientPortal settings={settings} services={services} barbers={barbers} plans={plans} configured={configured} configurationError={configurationError} />
}
