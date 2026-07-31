import test from 'node:test'
import assert from 'node:assert/strict'
import { groupAvailableSlots, isValidBookingInput, normalizePhone } from '../lib/booking-utils.mjs'

test('normaliza telefone removendo caracteres', () => {
  assert.equal(normalizePhone('(71) 99999-1234'), '71999991234')
})

test('agrupa horários iguais escolhendo um profissional disponível', () => {
  const slots = [
    { slot_start: '2026-08-01T09:00:00-03:00', barber_id: 'a', barber_name: 'A' },
    { slot_start: '2026-08-01T09:00:00-03:00', barber_id: 'b', barber_name: 'B' },
    { slot_start: '2026-08-01T09:30:00-03:00', barber_id: 'b', barber_name: 'B' },
  ]
  const grouped = groupAvailableSlots(slots, (value) => value.slice(11, 16))
  assert.equal(grouped.length, 2)
  assert.equal(grouped[0].barber_id, 'a')
})

test('exige nome completo, telefone, serviço e horário', () => {
  assert.equal(isValidBookingInput({ fullName: 'Guilherme Silva', phone: '71999991234', serviceId: 'svc', slot: { slot_start: '2026-08-01T09:00:00-03:00', barber_id: 'barber' } }), true)
  assert.equal(isValidBookingInput({ fullName: 'Guilherme', phone: '123', serviceId: '', slot: null }), false)
})
