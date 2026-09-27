import { Hono } from 'hono'
import { notImplemented } from './_stub.js'
import { requireMember } from './_auth.js'

export const holds = new Hono()

holds.use('*', requireMember)   // 全部要登入;授權(主辦 / 本人)在各 handler

holds.delete('/:id', notImplemented)          // 僅本人:主動放棄
holds.post('/:id/confirm', notImplemented)    // 僅本人:確認 → 建訂單 + 寫價格快照
