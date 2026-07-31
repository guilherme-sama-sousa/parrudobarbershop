import type { AvailableSlot } from './types'

export function normalizePhone(value?: string): string
export function groupAvailableSlots(
  slots: AvailableSlot[],
  formatTime: (value: string) => string,
): Array<AvailableSlot & { label: string }>
export function isValidBookingInput(input: {
  fullName: string
  phone: string
  serviceId: string
  slot: AvailableSlot | null
}): boolean
