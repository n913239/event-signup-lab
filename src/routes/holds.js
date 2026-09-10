import { Hono } from 'hono'
import { notImplemented } from './_stub.js'

export const holds = new Hono()

holds.delete('/:id', notImplemented)          // 僅本人:主動放棄
holds.post('/:id/confirm', notImplemented)    // 僅本人:確認 → 建訂單 + 寫價格快照
