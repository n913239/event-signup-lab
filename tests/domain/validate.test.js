// 輸入驗證(data-model.md「驗證規則」表逐條)。不合格一律 { ok: false, error: 'invalid_input' }。
import { describe, it, expect } from 'vitest'
import { register, login, eventCreate, eventPatch, ticketTypeCreate, ticketTypePatch, hold, promoCode } from '../../src/domain/validate.js'

const BAD = { ok: false, error: 'invalid_input' }
const T = 1_790_000_000_000

describe('register / login', () => {
  const ok = { email: 'A@Example.com', password: 'password', nickname: 'n' }
  it('email 小寫正規化', () => expect(register(ok)).toEqual({ ok: true, value: { email: 'a@example.com', password: 'password', nickname: 'n' } }))
  it('email 沒有 @', () => expect(register({ ...ok, email: 'a.example.com' })).toEqual(BAD))
  it('email 超過 254', () => expect(register({ ...ok, email: 'a'.repeat(243) + '@example.com' })).toEqual(BAD))
  it('password 7 字元', () => expect(register({ ...ok, password: '1234567' })).toEqual(BAD))
  it('password 剛好 8 字元', () => expect(register({ ...ok, password: '12345678' }).ok).toBe(true))
  it('nickname 空字串 / 51 字元', () => {
    expect(register({ ...ok, nickname: '' })).toEqual(BAD)
    expect(register({ ...ok, nickname: 'x'.repeat(51) })).toEqual(BAD)
  })
  it('缺欄位 / 非字串', () => {
    expect(register({ email: 'a@b.c', password: 'password' })).toEqual(BAD)
    expect(register({ ...ok, password: 12345678 })).toEqual(BAD)
    expect(register(null)).toEqual(BAD)
  })
  it('login 只要 email + password 字串', () => {
    expect(login({ email: 'A@b.c', password: 'x' })).toEqual({ ok: true, value: { email: 'a@b.c', password: 'x' } })
    expect(login({ email: 'a@b.c' })).toEqual(BAD)
  })
})

describe('eventCreate / eventPatch', () => {
  const ok = { name: '演唱會', opens_at: T, deadline_at: T + 1, group_min_qty: 4, group_pct: 10, hold_ttl_minutes: 10 }
  it('合法', () => expect(eventCreate(ok).ok).toBe(true))
  it('group / ttl 有預設值', () => {
    expect(eventCreate({ name: 'x', opens_at: T, deadline_at: T + 1 }).value)
      .toMatchObject({ group_min_qty: 4, group_pct: 10, hold_ttl_minutes: 10 })
  })
  it('opens_at 等於 deadline_at', () => expect(eventCreate({ ...ok, deadline_at: T })).toEqual(BAD))
  it('時間不是整數', () => expect(eventCreate({ ...ok, opens_at: T + 0.5 })).toEqual(BAD))
  it('name 101 字元', () => expect(eventCreate({ ...ok, name: 'x'.repeat(101) })).toEqual(BAD))
  it('group_min_qty 1', () => expect(eventCreate({ ...ok, group_min_qty: 1 })).toEqual(BAD))
  it('group_pct 101 / -1', () => {
    expect(eventCreate({ ...ok, group_pct: 101 })).toEqual(BAD)
    expect(eventCreate({ ...ok, group_pct: -1 })).toEqual(BAD)
  })
  it('hold_ttl_minutes 4 / 31 擋,5 / 30 過', () => {
    expect(eventCreate({ ...ok, hold_ttl_minutes: 4 })).toEqual(BAD)
    expect(eventCreate({ ...ok, hold_ttl_minutes: 31 })).toEqual(BAD)
    expect(eventCreate({ ...ok, hold_ttl_minutes: 5 }).ok).toBe(true)
    expect(eventCreate({ ...ok, hold_ttl_minutes: 30 }).ok).toBe(true)
  })
  it('patch 只收有給的欄位,空 patch 擋', () => {
    expect(eventPatch({ deadline_at: T + 5 })).toEqual({ ok: true, value: { deadline_at: T + 5 } })
    expect(eventPatch({})).toEqual(BAD)
    expect(eventPatch({ hold_ttl_minutes: 40 })).toEqual(BAD)
  })
  it('patch 可改名額(每項只給 id + capacity)', () => {
    expect(eventPatch({ ticket_types: [{ id: 't1', capacity: 30, price_cents: 1 }] }))
      .toEqual({ ok: true, value: { ticket_types: [{ id: 't1', capacity: 30 }] } })
    expect(eventPatch({ ticket_types: [] })).toEqual(BAD)
    expect(eventPatch({ ticket_types: [{ id: 't1', capacity: -1 }] })).toEqual(BAD)
  })
})

describe('ticketTypeCreate / ticketTypePatch', () => {
  const ok = { name: '一般', price_cents: 100000, capacity: 60 }
  it('合法;早鳥欄位預設 null / 0', () => {
    expect(ticketTypeCreate(ok)).toEqual({ ok: true, value: { ...ok, early_bird_until: null, early_bird_pct: 0 } })
  })
  it('price_cents 小數 / 負數', () => {
    expect(ticketTypeCreate({ ...ok, price_cents: 100.5 })).toEqual(BAD)
    expect(ticketTypeCreate({ ...ok, price_cents: -1 })).toEqual(BAD)
  })
  it('capacity 負數', () => expect(ticketTypeCreate({ ...ok, capacity: -1 })).toEqual(BAD))
  it('early_bird_pct 101', () => expect(ticketTypeCreate({ ...ok, early_bird_pct: 101 })).toEqual(BAD))
  it('patch 只改價格', () => {
    expect(ticketTypePatch({ price_cents: 90000 })).toEqual({ ok: true, value: { price_cents: 90000 } })
    expect(ticketTypePatch({ price_cents: '90000' })).toEqual(BAD)
  })
})

describe('hold', () => {
  it('合法', () => expect(hold({ ticket_type_id: '1', seat_nos: ['A1', 'J10'] }).ok).toBe(true))
  it('seat_nos 空 / 重複 / 格式錯', () => {
    expect(hold({ ticket_type_id: '1', seat_nos: [] })).toEqual(BAD)
    expect(hold({ ticket_type_id: '1', seat_nos: ['A1', 'A1'] })).toEqual(BAD)
    expect(hold({ ticket_type_id: '1', seat_nos: ['K1'] })).toEqual(BAD)
    expect(hold({ ticket_type_id: '1', seat_nos: ['A11'] })).toEqual(BAD)
    expect(hold({ ticket_type_id: '1', seat_nos: ['A0'] })).toEqual(BAD)
  })
  it('缺 ticket_type_id', () => expect(hold({ seat_nos: ['A1'] })).toEqual(BAD))
})

describe('promoCode', () => {
  it('存大寫', () => expect(promoCode('welcome')).toEqual({ ok: true, value: 'WELCOME' }))
  it('空字串 / 33 字元', () => {
    expect(promoCode('')).toEqual(BAD)
    expect(promoCode('x'.repeat(33))).toEqual(BAD)
  })
})
