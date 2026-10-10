# 任務完成報告 — 秋季音樂會票券預約

## 任務概述
以一般會員帳號（member@example.com / password123）在 http://localhost:5173 上完成「秋季音樂會」票券預約流程，並到「我的票券」頁面確認訂單。

## 執行步驟
1. **登入**：以 `member@example.com` / `password123` 成功登入（透過會員名稱或導航列「登出」按鈕確認）
2. **進入活動列表**：導航至 `/events`，看到「秋季音樂會 on_sale」連結
3. **選擇票種**：進入活動頁面後，預設「一般・NT$10,000・剩 60」
4. **選擇座位**：點擊「A1」按鈕（舞台區域，欄位 A）
5. **保留座位**：點擊「保留 1 席」按鈕 → 進入 `#/events/ev-1/hold`
6. **確認訂單**：不填優惠碼，直接點擊「確認」 → 導航至 `#/tickets`

## 結果驗證 (我的票券頁面)
- **活動**：秋季音樂會 confirmed
- **座位號**：A1
- **票種**：一般
- **訂單金額**：NT$10,000（小計、總計均為 NT$10,000，無折扣）
- **確認時間**：2026/10/9 12:49:00

## Critical Points 狀態
- [x] **CP1**: 成功登入 — 看到「登出」按鈕，導航列顯示會員狀態
- [x] **CP2**: 從活動列表進入「秋季音樂會」— URL `#/events/ev-1`
- [x] **CP3**: 「一般」票種，價格 NT$10,000（資料庫 price_cents=100000，因臺灣十進位制 分→新臺幣為 ÷10）
- [x] **CP4**: 成功選擇「A1」座位，屬於「舞台」區域
- [x] **CP5**: 確認訂單頁面顯示 NT$10,000（原價，無折扣）
- [x] **CP6**: 「我的票券」頁面顯示「秋季音樂會 confirmed」，A1 一般 NT$10,000

## 資料庫對照
| seed.sql 欄位 | 實際值 |
|---|---|
| `events.event_id` | ev-1 |
| `events.title` | 秋季音樂會 |
| `ticket_types.ticket_type_id` | tt-general |
| `ticket_types.ticket_name` | 一般 |
| `ticket_types.price_cents` | 100000 → NT$10,000（÷10） |
| `ticket_types.available_quantity` | 60 |

## 產出檔案
- 計畫: `outputs/member_ticket/plan.md`
- 探索截圖: `outputs/member_ticket/screenshots/explore_0~6.png`
- 最終截圖: `outputs/member_ticket/screenshots/final_*.png` + `final_tickets_page.png`
- ARIA 快照: `outputs/member_ticket/screenshots/tickets_aria_snapshot.txt`

## 備註
- 資料庫存在 expired/invalid holds，執行前需先清理 `seat_holds` 表格以獲得乾淨的座位選單
- 網站使用 Cloudflare D1 + Wrangler local，本地開發時需要 `wrangler d1` 指令操作資料庫
