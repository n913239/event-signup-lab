import { Hono } from 'hono'
import { notImplemented } from './_stub.js'

export const events = new Hono()

events.post('/', notImplemented)                      // staff 建活動,直接是 on_sale
events.get('/', notImplemented)                       // 列表,可 ?status=on_sale
events.get('/:id', notImplemented)                    // 含票種、剩餘名額、座位狀態
events.patch('/:id', notImplemented)                  // 僅主辦:改名額 / 時間
events.post('/:id/close', notImplemented)             // 僅主辦:手動提前截止
events.post('/:id/ticket-types', notImplemented)      // 僅主辦:建票種
events.post('/:id/holds', notImplemented)             // 選位 + 保留,seat_nos 全有全無
