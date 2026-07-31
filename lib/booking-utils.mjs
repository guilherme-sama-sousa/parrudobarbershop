export function normalizePhone(value = '') {
  return String(value).replace(/\D/g, '').slice(0, 13)
}

export function groupAvailableSlots(slots = [], formatTime) {
  const grouped = new Map()
  for (const slot of slots) {
    const label = formatTime(slot.slot_start)
    if (!grouped.has(label)) grouped.set(label, slot)
  }
  return Array.from(grouped.entries()).map(([label, slot]) => ({ label, ...slot }))
}

export function isValidBookingInput({ fullName, phone, serviceId, slot }) {
  return Boolean(
    String(fullName || '').trim().split(/\s+/).length >= 2 &&
      normalizePhone(phone).length >= 10 &&
      serviceId &&
      slot?.slot_start &&
      slot?.barber_id,
  )
}
