# Quickstart:端到端驗證(Phase 1)

**Feature**: 001-event-signup-full · **Date**: 2026-09-14

這份是「怎麼證明它會動」,不是「怎麼寫」。每一段都對應 spec 的 SC 或 FR;跑不出來的那格就是 `docs/verified.md` 的 ❌ 欄。

## 前置

```bash
node -v        # 22
npm ci
cp .dev.vars.example .dev.vars   # JWT_SECRET、QR_SECRET(任務階段補這個 example 檔)
```

## 0. 尺先於被量的東西(現在就能跑)

```bash
sh scripts/self-test.sh          # 40/40:五支裁判抓得到、不誤報
npm run test:schema:selftest     # 9/9:schema 裁判自己被驗過
npm run check:all                # 五支裁判在目前 src/ 上綠燈
npm test                         # 骨架:17 條路由 501、/health、閘門 helper
```

## 1. schema(作者手寫後)

```bash
npm run test:schema              # 8 組:整數金額、時間型別一致、CHECK、部分唯一索引含 confirmed、remaining >= 0、order_items 有單價快照、表白名單、STRICT
npm run db:init && npm run db:seed
```
對無菌室版:`SCHEMA=devlog/raw/exp-01/schema.sql npm run test:schema` —— 同一把尺。

## 2. 契約

```bash
npm run test:contract            # 每條 route 的回應對 openapi.yaml 驗;501 階段也要過(error schema)
```
契約正本在 repo 根 `openapi.yaml`(設計稿:[contracts/openapi.yaml](contracts/openapi.yaml))。

## 3. 本機起 API,走一遍主流程(SC-005 的手動版;`scripts/smoke.sh` 之後自動化這段)

```bash
npm run dev                      # http://127.0.0.1:8788
```

```bash
B=http://127.0.0.1:8788
# 註冊 + 登入(seed 已有 staff@example.com / password123 為 staff)
curl -s $B/auth/register -d '{"email":"a@x.io","password":"password1","nickname":"A"}' -H 'content-type: application/json'
TOK=$(curl -s $B/auth/login -d '{"email":"staff@example.com","password":"password123"}' -H 'content-type: application/json' | jq -r .access_token)
MEM=$(curl -s $B/auth/login -d '{"email":"a@x.io","password":"password1"}' -H 'content-type: application/json' | jq -r .access_token)

# 主辦建活動 + 票種
EV=$(curl -s $B/events -H "authorization: Bearer $TOK" -H 'content-type: application/json' \
  -d '{"name":"demo","opens_at":0,"deadline_at":4102444800000}' | jq -r .id)
TT=$(curl -s $B/events/$EV/ticket-types -H "authorization: Bearer $TOK" -H 'content-type: application/json' \
  -d '{"name":"一般","price_cents":100000,"capacity":60,"early_bird_pct":10,"early_bird_until":4102444800000}' | jq -r .id)

# 成員選 4 座(觸發團體 10%)→ 保留 → 確認帶優惠碼
H=$(curl -s $B/events/$EV/holds -H "authorization: Bearer $MEM" -H 'content-type: application/json' \
  -d "{\"ticket_type_id\":\"$TT\",\"seat_nos\":[\"A1\",\"A2\",\"A3\",\"A4\"]}" | jq -r .id)
curl -s $B/holds/$H/confirm -H "authorization: Bearer $MEM" -H 'content-type: application/json' -d '{"promo_code":"WELCOME"}' | jq .
```

期望:`subtotal_cents = 400000`、`early_bird_pct = 10`、`group_pct = 10`、`promo_cents = 10000`,
`total_cents = applyPct(applyPct(400000,10),10) − 10000 = 324000 − 10000 = 314000`。**不是** 315900(先減後乘)也不是 310000(並聯)。

再驗:
- `curl -s $B/orders -H "authorization: Bearer $MEM"` 兩張票同一份資料(SC-007 的 API 端)。
- 主辦 `PATCH /ticket-types/$TT` 改價 → 重讀訂單 `total_cents` 不變(規則 V)。
- 成員 `POST /orders/:id/cancel` → `status = cancelled`,再 hold A1 → 201(C11)。
- 另一個 staff 帳號 `PATCH /events/$EV` → 403(C4)。

## 4. 邊界(SC-005 九條,自動)

```bash
npx vitest run tests/routes      # 每個邊界一條測試:closed、過 deadline_at、未到 opens_at、過期 hold 確認、改價後不變、403、終態、超賣、重座
npx vitest run tests/domain      # money(R4 向量)、time-rules(兩個真相來源分開)、states
npm run test:jwt                 # repo 內能寫的那幾項;七項清單在 repo 外
```

時間邊界用 `tests/helpers/clock.js` 推 `now`,**不睡覺、不等真實時間**。

## 5. 併發(SC-001 / 002 / 004)

```bash
for i in 1 2 3 4 5; do npm run test:race || exit 1; done   # CI 同一行;5 次一致才算重現
```
- 不超賣:N = 名額 + 5 個成員閘門同放,成功數 = 名額,成功 + 失敗 = N。
- 不重座:N 個成員搶 A1,恰一人 201,其餘 409 `seat_taken`。
- 三方競態:hold 到期瞬間,原持有人 confirm、他人 hold、`sweepExpired` 同時放行,結果被測試釘住(哪個贏是作者 Day 27 的決定,測試只要求**每次一樣**)。

真實多連線(部署後):
```bash
BASE_URL=https://<worker>.workers.dev sh scripts/race.sh   # 目前空殼,任務階段填實
```

## 6. web(SC-007 前半)

```bash
cd web && npm ci && npm run dev   # http://localhost:5173,proxy → 8788
```
五個畫面:登入/註冊 → 活動列表 → 活動頁 10×10 點座位 → 保留倒數(以 `server_now` 校正)→ 確認 → 我的票券(QR)。
金額顯示只經過 `web/src/lib/money.js`;`sh scripts/check-money.sh` 擴掃 `web/src` 後仍綠。

## 7. iOS(SC-007 後半、SC-008)

```bash
cp openapi.yaml ios/EventSignup/Sources/openapi.yaml && open ios/EventSignup   # build plugin 產 Client
```
登入 → 票券列表 → 明細(QR)。同一帳號與 web 逐欄比對 `GET /orders`。
飛航模式重開 app:顯示快取 + 「離線資料」標籤;登出按鈕提示需要連線。

SC-008:`wrangler dev` 的 D1 log 或 `meta.rows_read` 記 `GET /orders` 一次載入的讀取數,寫進 `docs/verified.md`。

## 8. 最後一道:靜態裁判 + CI 帳本

```bash
npm run check:all && sh scripts/self-test.sh && npm test
```
CI(`.github/workflows/ci.yml`)每輪把閘門結果寫進 job summary;Day 30 的「量了幾次、擋下幾次」從那裡數。
