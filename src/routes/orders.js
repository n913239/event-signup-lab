import { Hono } from 'hono'
import { notImplemented } from './_stub.js'
import { requireMember } from './_auth.js'

export const orders = new Hono()

orders.use('*', requireMember)   // 全部要登入;授權(主辦 / 本人)在各 handler

orders.get('/', notImplemented)               // 我的票券
orders.get('/:id', notImplemented)            // 本人或主辦:明細,含金額快照
orders.post('/:id/cancel', notImplemented)    // 僅本人
