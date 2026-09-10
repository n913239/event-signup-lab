import { Hono } from 'hono'
import { notImplemented } from './_stub.js'

export const ticketTypes = new Hono()

// 改票價。這條是價格快照的觸發器 —— 改完之後歷史訂單的金額不能跟著變。
ticketTypes.patch('/:id', notImplemented)
