/**
 * schema 的裁判 —— 寫在 schema 存在之前。
 *
 * `/check-schema` 是叫 AI 讀檔案回報;這一支是**真的建表、真的塞資料、
 * 真的試著違反約束看它擋不擋**。同一組斷言之後也會拿去打無菌室那版
 * (`SCHEMA=devlog/raw/exp-01/schema.sql npx vitest run tests/schema.test.js`),
 * 兩份 schema 用同一把尺量,差異才有意義。
 *
 * ⚠️ 這裡不寫「schema 應該長什麼樣」,只寫「它必須擋得住什麼」。
 *    欄位名、型別、表怎麼拆,是被測的那一方的自由。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPlatformProxy } from 'wrangler'
import { readFileSync, existsSync } from 'node:fs'

const SCHEMA = process.env.SCHEMA ?? 'schema.sql'
const HAS_SCHEMA = existsSync(SCHEMA)

let proxy, db, sql

beforeAll(async () => {
  if (!HAS_SCHEMA) return
  sql = readFileSync(SCHEMA, 'utf8')
  proxy = await getPlatformProxy({ persist: false })
  db = proxy.env.DB
  // D1 的 exec() 不吃多行語句,自己切開再 batch
  const stmts = sql.split(/;\s*$/m).map((s) => s.trim())
    .filter((s) => s && !s.startsWith('--'))
  await db.batch(stmts.map((s) => db.prepare(s)))
})

afterAll(async () => { await proxy?.dispose() })

const d = HAS_SCHEMA ? describe : describe.skip
if (!HAS_SCHEMA) {
  describe('schema', () => {
    it.skip(`${SCHEMA} 還不存在 —— 作者手寫之後這些斷言才會跑`, () => {})
  })
}

/** 使用者建的表。要濾掉 D1 自己的內部表,否則每條斷言都會被它絆倒 */
const tables = async () => (await db.prepare(
  `SELECT name FROM sqlite_master WHERE type='table'
     AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'`
).all()).results.map((r) => r.name)

/**
 * 某張表的欄位。
 * ⚠️ D1 擋 `PRAGMA table_info(t)`(回 SQLITE_AUTH),但放行同名的
 *    table-valued function `pragma_table_info('t')` —— 2026-09-10 實測。
 *    差一個寫法,一個全紅一個全綠。
 */
const cols = async (t) => (await db.prepare(
  "SELECT name, type FROM pragma_table_info(?)").bind(t).all()).results

d('① 金額欄位是整數,而且欄名帶單位', () => {
  it('所有金額欄都是 INTEGER,沒有 REAL / NUMERIC / DOUBLE', async () => {
    const bad = []
    for (const t of await tables()) {
      for (const c of await cols(t)) {
        if (/(_cents|_amount|price|total|fee)/i.test(c.name) &&
            !/^INT/i.test(c.type)) bad.push(`${t}.${c.name} ${c.type}`)
      }
    }
    expect(bad, '金額欄不可以是浮點型別').toEqual([])
  })

  it('金額欄的名字帶單位(`_cents`)', async () => {
    const bad = []
    for (const t of await tables()) {
      for (const c of await cols(t)) {
        if (/(price|amount|total|fee)/i.test(c.name) &&
            !/_cents$/i.test(c.name) && !/_id$/i.test(c.name) &&
            !/(_at|_count|_seats|_locked)$/i.test(c.name)) bad.push(`${t}.${c.name}`)
      }
    }
    expect(bad, '金額欄名要帶單位,例如 unit_price_cents').toEqual([])
  })
})

d('② 時間欄位型別一致', () => {
  it('全部 INTEGER epoch 或全部 TEXT ISO,不可混用', async () => {
    const types = new Set()
    for (const t of await tables()) {
      for (const c of await cols(t)) {
        if (/(_at|_until)$/i.test(c.name)) types.add(c.type.toUpperCase().replace(/\(.*/, ''))
      }
    }
    expect([...types], '時間欄型別混用會讓比較大小的行為不一致').toHaveLength(1)
  })
})

d('③ status 有 CHECK,而且列舉值不多不少', () => {
  it('每個 status 欄都被 CHECK 約束住', async () => {
    const unchecked = []
    for (const t of await tables()) {
      const has = (await cols(t)).some((c) => /status$/i.test(c.name))
      if (!has) continue
      const ddl = (await db.prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name=?").bind(t).first())?.sql ?? ''
      if (!/CHECK\s*\(/i.test(ddl)) unchecked.push(t)
    }
    expect(unchecked, 'status 沒有 CHECK,任何字串都塞得進去').toEqual([])
  })

  it('列舉值不多不少 —— 沒有狀態機以外的值', async () => {
    // 狀態機的全集(docs/spec.md)。刻意不斷言「哪張表該有哪幾個」——
    // 多座 hold 之後 seat_holds 與 orders 怎麼分,是作者的設計自由。
    // 這裡只擋「冒出一個沒人處理的狀態」。
    const KNOWN = new Set([
      'draft', 'on_sale', 'closed', 'finished', 'cancelled',   // 活動
      'holding', 'confirmed', 'checked_in', 'expired',          // hold / 訂單
      'member', 'staff',                                        // 角色
    ])
    const ddl = (await db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL").all())
      .results.map((r) => r.sql).join('\n')
    const found = [...ddl.matchAll(/CHECK\s*\([^)]*?\bIN\s*\(([^)]*)\)/gi)]
      .flatMap((m) => m[1].split(',').map((x) => x.trim().replace(/^'|'$/g, '')))
    expect(found.length, '找不到任何 CHECK … IN (…) 列舉').toBeGreaterThan(0)
    const extra = [...new Set(found)].filter((v) => !KNOWN.has(v))
    expect(extra, '多一個列舉值 = 有一個狀態沒人處理').toEqual([])
  })
})

d('④ 座位唯一性由部分唯一索引保證', () => {
  it('索引存在,而且述詞含 confirmed', async () => {
    const idx = (await db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL").all())
      .results.map((r) => r.sql).join('\n')
    expect(idx, '座位唯一性要用部分唯一索引').toMatch(/UNIQUE\s+INDEX/i)
    expect(idx, '述詞只寫 holding 的話,已確認的座位會失去保護').toMatch(/WHERE[\s\S]*confirmed/i)
  })

  it('普通 UNIQUE(event_id, seat_no) 不算過關', async () => {
    const ddl = (await db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table'").all())
      .results.map((r) => r.sql).join('\n')
    expect(ddl, '普通 UNIQUE 會讓過期列一直佔著 key,座位無法重佔')
      .not.toMatch(/UNIQUE\s*\(\s*event_id\s*,\s*seat_no\s*\)/i)
  })
})

d('⑤ 名額不可為負', () => {
  it('remaining 有 CHECK (remaining >= 0)', async () => {
    const ddl = (await db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table'").all())
      .results.map((r) => r.sql).join('\n')
    expect(ddl, 'CHECK 是超賣的第二道防線').toMatch(/CHECK\s*\(\s*remaining\s*>=\s*0\s*\)/i)
  })
})

d('⑥ 訂單明細存了價格快照', () => {
  it('明細表上有自己的單價欄,不是只靠 ticket_type_id JOIN', async () => {
    const t = (await tables()).find((x) => /order_item/i.test(x))
    expect(t, '找不到訂單明細表').toBeTruthy()
    const names = (await cols(t)).map((c) => c.name)
    expect(names.some((n) => /price.*_cents$|_cents$/i.test(n)),
      `${t} 沒有自己的單價欄,票價一改歷史訂單就跟著變`).toBe(true)
  })
})

d('⑦ 沒有規格以外的表', () => {
  it('表的清單落在允許範圍內', async () => {
    const allowed = /^(members?|events?|ticket_types?|seat_holds?|orders?|order_items?|refresh_tokens?|promo_codes?|_cf_METADATA|d1_migrations)$/i
    const extra = (await tables()).filter((t) => !allowed.test(t))
    expect(extra, '多的表要嘛寫進規格,要嘛不要建').toEqual([])
  })
})

d('⑧ 用了 STRICT', () => {
  it('每張表都是 STRICT(型別才真的被強制)', async () => {
    const loose = []
    for (const t of await tables()) {
      const ddl = (await db.prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name=?").bind(t).first())?.sql ?? ''
      if (!/\bSTRICT\b/i.test(ddl)) loose.push(t)
    }
    expect(loose, '沒有 STRICT 的話,INTEGER 欄位照樣塞得進字串').toEqual([])
  })
})
