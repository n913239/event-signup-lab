# Day 28:免費額度帳單與 N+1 對照(2026-09-27 實測)

流量來源:這一天的 smoke、race.sh(5 輪 × 20 連線 × 2 個活動)、compare-clients、XCUITest 與人工操作 —— **使用者不是真的,用量是真的**。

## 1. D1(`npx wrangler d1 info signup`,過去 24 小時)

| | 免費額度 | 用掉 | 佔比 |
|---|---:|---:|---:|
| rows read | 5,000,000 / 日 | 5,711 | 0.11% |
| rows written | 100,000 / 日 | 1,711 | 1.71% |
| 儲存 | 5 GB | 193 kB | 0.004% |
| (read / write queries) | — | 1,044 / 493 | — |

讀最多的前幾句(`wrangler d1 insights signup --timePeriod 1d --sort-by reads`):建 hold 前的「還名額」UPDATE 1,059 列 / 152 次、活動列表 456 列 / 279 次、sweep 369 列 / 66 次。

Workers 請求數 wrangler 查不到(要 Cloudflare analytics API 或 dashboard)—— 待作者從 dashboard 抄。

## 2. 「我的票券」:一次 JOIN vs N+1(`n-plus-1.mjs`,遠端 D1 實跑)

對象:`demo-buyer@example.com`,6 張訂單、14 席。

| 寫法 | 查詢數 | rows_read |
|---|---:|---:|
| 一次 JOIN(`src/lib/db/orders.js` 現行) | 1 | 60 |
| N+1(訂單 → 逐張活動與明細 → 逐席票種) | 27 | 52 |

**草稿原本的假設「寫成 N+1,rows read 會翻十倍」在這裡不成立** —— N+1 的每一句都是走索引的點查詢(1 列),rows read 反而略少;JOIN 多讀的是排序與連接。
N+1 貴的是**查詢次數**:27 次對 1 次。Workers 上每一次 D1 查詢都是一趟往返 —— 吃的是延遲與查詢數,不是 rows read 額度。
