'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export type SupabaseConfigStatus = 'ok' | 'missing' | 'invalid_url'

/**
 * Valida a configuração sem quebrar a página.
 * - 'missing': variáveis ausentes → site roda em modo demonstração.
 * - 'invalid_url': NEXT_PUBLIC_SUPABASE_URL preenchida com valor que não é URL.
 */
export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return 'missing'

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return 'invalid_url'
  } catch {
    return 'invalid_url'
  }

  return 'ok'
}

export function isSupabaseConfigured() {
  return getSupabaseConfigStatus() === 'ok'
}

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase ainda não configurado corretamente. Verifique as variáveis de ambiente.')
  }

  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    )
  }

  return client as SupabaseClient
}
