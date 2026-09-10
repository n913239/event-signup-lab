import { Hono } from 'hono'
import { notImplemented } from './_stub.js'

export const orders = new Hono()

orders.get('/', notImplemented)               // 我的票券
orders.get('/:id', notImplemented)            // 本人或主辦:明細,含金額快照
orders.post('/:id/cancel', notImplemented)    // 僅本人
