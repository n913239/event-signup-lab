# Quickstart:驗證現況

**Phase 1 output** · 2026-09-27

這份是「怎麼證明它是對的」的跑法,不是教學。指令都來自 `package.json` 與 `scripts/`;
本次 `/speckit-plan` 沒有實際執行(本 session 沒有權限),預期結果以 commit `ec550fa` 的紀錄為準。

## 前置

- Node(可跑 wrangler 4 與 vitest 3)、`npm install`
- web:`cd web && npm install`
- iOS:Xcode(Swift 6 tools)、iOS 17 SDK

## 1. 硬規則的裁判(constitution 五條)

```sh
npm run check:all          # money → time → jwt → race → snapshot,五支都要 ✅
sh scripts/self-test.sh    # 證明五支都「抓得到」也「不誤報」;會暫時寫入探針檔再刪掉
npm run test:schema        # 含 ⑥:order_items 有自己的 _cents(規則 V 的另一半)
```

預期:五支 ✅、self-test 沒有 🔴、schema 測試全綠。

## 2. 行為測試

```sh
npm test                   # 全部(紀錄:228/228)
npm run test:race          # 超賣、重座、三方競態、H7 併發(閘門,可重跑 5 次結果一致)
npm run test:jwt           # 規則 IV 的 JWT 邊界六個測試
npm run test:contract      # 每條 operation 的回應符合 openapi.yaml
```

對照 spec(依檔名與 clarify 查核時看到的測試位置整理,未逐條核對每個 SC 都有斷言):

| spec | 測試位置 |
|---|---|
| SC-001 不超賣 / SC-002 不重座 / SC-003 三方競態 | `tests/concurrency.test.js` |
| SC-004 擇優 90000 分 | `tests/domain/money.test.js` |
| SC-005 十條規則、時間邊界分開 | `tests/domain/time-rules.test.js`、`tests/routes/holds.test.js` |
| SC-006 越權 403 | `tests/routes/events.test.js`、`tests/routes/ticket-types.test.js` |
| SC-007 改價後訂單不變 | `tests/routes/orders.test.js`、`tests/schema.test.js` |
| SC-010 JWT | `tests/jwt.test.js` |
| US2 鎖定 | `tests/routes/login-lockout.test.js` |
| US4 試算 | `tests/routes/quote.test.js` |

## 3. 本機端到端

```sh
npm run db:init && npm run db:seed
npm run dev                # API 在 http://localhost:8788
npm run smoke              # scripts/smoke.sh
cd web && npm run dev      # web 在 http://localhost:5173(CORS_ORIGIN 由 .dev.vars 覆寫)
```

手動走一次 US1:登入 → 活動頁選 2 席 → 保留倒數出現 → 按「套用」看試算 → 確認 → 我的票券看到 QR → 取消 → 回活動頁座位變空。

## 4. iOS

```sh
sh scripts/sync-openapi.sh                 # 契約有改就同步副本(⚠️ plan C-2)
cd ios/EventSignup && swift build
```

預期:build 過;Xcode 跑 `ios/App` 可登入、看活動列表 → 明細座位圖、我的票券(離線時仍可讀快取)。

## 5. 尚未有跑法的項目

- **SC-009** `rows_read`:repo 沒有量測腳本,交給 tasks(plan D-4)。
- **SC-008** web 與 iOS 顯示一致:沒有自動化比對;iOS 千分位依 locale(plan G1-a)。
- web 沒有自動化測試。
