import { Hono } from 'hono'
import { notImplemented } from './_stub.js'
import { requireMember } from './_auth.js'

export const ticketTypes = new Hono()

ticketTypes.use('*', requireMember)   // 全部要登入;授權(主辦 / 本人)在各 handler

// 改票價。這條是價格快照的觸發器 —— 改完之後歷史訂單的金額不能跟著變。
ticketTypes.patch('/:id', notImplemented)
