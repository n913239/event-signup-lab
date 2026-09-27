# 活動報名系統

2026 iThome 鐵人賽「盡信 Claude,不如無 Code —— 心法與全端實戰」Day 21–30 的實作對象。

對外是活動報名,對內跑**售票的規則**:限量名額、搶、狀態機、逾時釋放。不收錢(非目標 3)。

## 為什麼是這個題目

七條**能被機器裁決、而眼睛看不出來**的規則:

| # | 規則 |
|---|---|
| 1 | 金額精度 |
| 2 | 折扣疊加順序(早鳥 × 團體 × 優惠碼) |
| 3 | 價格快照 |
| 4 | 超賣 |
| 5 | 座位唯一性 |
| 6 | 保留 TTL 的三方競態 |
| 7 | JWT 七項邊界 |

其中 2、3、6 是「兩種做法看起來都對,而沒有裁判會紅」那一族。

## 技術棧

Cloudflare Workers + Hono + D1 · Pages(web)· SwiftUI(iOS)· 自製 JWT · OpenAPI 契約

**一份契約餵兩個前端** —— 契約錯的時候,兩邊各自都是對的。

## 現在的狀態

尺與被量的東西都有了:18 條 endpoint、web、iOS 骨架,部署在 Cloudflare(Workers + D1 + Pages)。

```bash
sh scripts/self-test.sh        # 41 筆探針:五支靜態檢查抓得到、而且不誤報
npm test                       # 245 個測試(含 fuzz 20,000 組、契約測試)
npm run check:all              # 五支靜態檢查(含 web/src、ios/)
npm run test:race              # 單一 process 閘門併發,每條重跑 5 次
npm run dev && npm run smoke   # 本機端到端(只打本機,用 seed 帳密)
BASE_URL=… STAFF_TOKEN=… sh scripts/race.sh 5          # 真的多連線打遠端 Worker
BASE_URL=… ACCESS_TOKEN=… bash scripts/compare-clients.sh  # curl vs iOS 逐欄比
cd web && npm run dev          # web(Vite,/api 代理到 8788)
cd ios/App && xcodegen         # iOS app 殼;畫面與 client 在 ios/EventSignup(swift test)
```

逐項狀態見 `docs/verified.md`。

## 紀律

- `docs/EXPERIMENT-PROTOCOL.md` —— schema 與四個實驗的順序**不可逆**
- `docs/verified.md` —— ✅ 跑過的 / ❌ 沒跑過的,**❌ 欄不准寫成結果**
- `docs/non-goals.md` —— 15 條不做的事


> ⚠️ **`seed.sql` 只給本機開發用**:兩個帳號的密碼都是 `password123`。**永遠不要對遠端跑 `db:seed`**(`--remote`)—— 那等於把 staff 帳號公開。線上帳號自己註冊,staff 用 `wrangler d1 execute signup --remote --command "UPDATE members SET role='staff' WHERE email='…'"` 升級。
