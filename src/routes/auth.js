import { Hono } from 'hono'
import { notImplemented } from './_stub.js'

export const auth = new Hono()

auth.post('/register', notImplemented)   // 建立成員
auth.post('/login', notImplemented)      // access(短)+ refresh(長)
auth.post('/refresh', notImplemented)    // 輪替,舊 refresh 立刻失效
auth.post('/logout', notImplemented)     // 撤銷當前 refresh
