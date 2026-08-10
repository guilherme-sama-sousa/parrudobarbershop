export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled'

export interface SiteSettings {
  id: number
  business_name: string
  tagline: string
  whatsapp: string | null
  instagram: string | null
  address: string | null
  logo_url: string | null
}

export interface Service {
  id: string
  name: string
  description: string | null
  price: number
  duration_minutes: number
  active: boolean
}

export interface Barber {
  id: string
  name: string
  specialties: string[]
  photo_url: string | null
  active: boolean
}

export interface AvailableSlot {
  slot_start: string
  barber_id: string
  barber_name: string
}

export interface Appointment {
  id: string
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  notes: string | null
  clients: { full_name: string; phone: string } | null
  services: { name: string; price: number } | null
  barbers: { name: string } | null
}

export interface BlockedTime {
  id: string
  starts_at: string
  ends_at: string
  reason: string | null
  barbers: { name: string } | null
}

export interface Plan {
  id: string
  name: string
  description: string | null
  price: number
  sort_order: number
  active: boolean
}

export interface BusinessHour {
  day_of_week: number
  open_time: string
  close_time: string
  slot_minutes: number
  active: boolean
}

export interface AdminUser {
  id: string
  full_name: string
  role: string
  created_at: string
}

export interface StockBalance {
  id: string
  name: string
  category: string | null
  unit: string
  minimum_stock: number
  current_stock: number
  photo_url: string | null
  active: boolean
}

export interface ClientProfile {
  id: string
  user_id: string
  full_name: string
  phone: string
  email: string | null
}

export interface ClientAppointment {
  id: string
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  notes: string | null
  services: { name: string; price: number; duration_minutes: number } | null
  barbers: { name: string } | null
}

export type CashMovementType = 'entry' | 'exit'

export interface CashTransaction {
  id: string
  movement_type: CashMovementType
  amount: number
  description: string
  barber_id: string | null
  occurred_on: string
  created_at: string
  barbers: { name: string } | null
}

export interface Subscriber {
  id: string
  full_name: string
  phone: string
  active: boolean
  started_on: string
  created_at: string
  updated_at: string
}

export interface SubscriberPayment {
  id: string
  subscriber_id: string
  reference_month: string
  paid_at: string
  created_at: string
}
