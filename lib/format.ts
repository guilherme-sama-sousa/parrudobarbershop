export const bahiaDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Bahia',
  dateStyle: 'short',
})

export const bahiaDateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Bahia',
  dateStyle: 'short',
  timeStyle: 'short',
})

export const bahiaTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Bahia',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function toLocalDateInput(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bahia',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return `${get('year')}-${get('month')}-${get('day')}`
}

export function normalizePhone(value: string) {
  return value.replace(/\D/g, '').slice(0, 13)
}

export function maskPhone(value: string) {
  const digits = normalizePhone(value)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}
