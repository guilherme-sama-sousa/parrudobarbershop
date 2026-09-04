import test from 'node:test'
import assert from 'node:assert/strict'
import { isUuid } from '../lib/uuid.mjs'

test('aceita UUIDs retornados pelo Supabase', () => {
  assert.equal(isUuid('123e4567-e89b-12d3-a456-426614174000'), true)
  assert.equal(isUuid('A987FBC9-4BED-3078-CF07-9141BA07C9F3'), true)
})

test('rejeita IDs locais de demonstração antes de chamar o banco', () => {
  assert.equal(isUuid('demo-tesoura'), false)
  assert.equal(isUuid('demo-rafael'), false)
  assert.equal(isUuid(''), false)
  assert.equal(isUuid(null), false)
})
