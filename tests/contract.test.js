// 契約測試:openapi.yaml 是裁判。
// 對每一條 operation 打一次,驗兩件事:
//   1. 回應的 status 是契約列出的其中一個(501 例外見下)
//   2. body 符合契約裡那個 status 的 schema
// 骨架階段 handler 全回 501 —— 契約沒列 501,但 not_implemented 在 Error.error 的 enum 裡,
// 所以 501 只准以 Error 形狀出現。每接好一條,它就自動改成驗真正的回應。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { createApp } from '../src/app.js'

const doc = parse(readFileSync(new URL('../openapi.yaml', import.meta.url), 'utf8'))
const ajv = new Ajv2020({ strict: false, allErrors: true })
addFormats(ajv)
ajv.addSchema(doc, 'openapi')

// 契約內的 '#/components/...' 改指向已註冊的整份文件
const rebase = (node) => {
  if (Array.isArray(node)) return node.map(rebase)
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) =>
      [k, k === '$ref' && typeof v === 'string' && v.startsWith('#/') ? `openapi${v}` : rebase(v)]))
  }
  return node
}
const deref = (r) => r?.$ref?.startsWith('#/components/responses/')
  ? doc.components.responses[r.$ref.split('/').pop()] : r
const jsonSchemaOf = (resp) => resp?.content?.['application/json']?.schema

const METHODS = ['get', 'post', 'put', 'patch', 'delete']
const operations = Object.entries(doc.paths).flatMap(([path, item]) =>
  METHODS.filter((m) => item[m]).map((m) => [m.toUpperCase(), path, item[m]]))

const app = createApp()

describe('契約', () => {
  it('19 條 operation(18 條 endpoint + /health)', () => {
    expect(operations).toHaveLength(19)
  })

  it.each(operations)('%s %s 符合契約', async (method, path, op) => {
    const url = path.replace(/\{[^}]+\}/g, '1')
    const init = { method }
    if (op.requestBody) {
      init.headers = { 'content-type': 'application/json' }
      init.body = '{}'
    }
    const res = await app.request(url, init, {})
    const status = String(res.status)
    const body = await res.json()

    let schema
    if (status === '501') {
      expect(body.error).toBe('not_implemented')
      schema = doc.components.schemas.Error
    } else {
      expect(Object.keys(op.responses)).toContain(status)
      schema = jsonSchemaOf(deref(op.responses[status]))
    }
    if (schema) {
      const validate = ajv.compile(rebase(schema))
      expect(validate(body), JSON.stringify(validate.errors)).toBe(true)
    }
  })
})
