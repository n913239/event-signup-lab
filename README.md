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

Cloudflare Workers + Hono + D1 ｜ Pages(web)｜ SwiftUI(iOS)｜ 自製 JWT ｜ OpenAPI 契約

**一份契約餵兩個前端** —— 契約錯的時候,兩邊各自都是對的。

## 現在的狀態

尺造好了,被量的東西還沒有。

```bash
sh scripts/self-test.sh   # 五支靜態檢查證明自己抓得到
npm test                  # 閘門 helper
npm run check:all         # 三支靜態檢查
```

尚未實作:schema、所有 endpoint、金額引擎、JWT、前端。
逐項狀態見 `docs/verified.md`。

## 紀律

- `docs/EXPERIMENT-PROTOCOL.md` —— schema 與四個實驗的順序**不可逆**
- `docs/verified.md` —— ✅ 跑過的 / ❌ 沒跑過的,**❌ 欄不准寫成結果**
- `docs/non-goals.md` —— 15 條不做的事
