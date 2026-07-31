/**
 * Extrai a mensagem real de qualquer erro (Error, PostgrestError do Supabase,
 * AuthError, objetos com message/hint/details), para nunca cair em texto genérico.
 */
export function getErrorMessage(caught: unknown, fallback: string): string {
  if (caught instanceof Error && caught.message) return caught.message
  if (caught && typeof caught === 'object') {
    const err = caught as { message?: string; error_description?: string; hint?: string; details?: string; code?: string }
    const parts = [err.message || err.error_description, err.details, err.hint].filter(Boolean)
    if (parts.length) return `${parts.join(' — ')}${err.code ? ` (código ${err.code})` : ''}`
  }
  if (typeof caught === 'string' && caught) return caught
  return fallback
}
