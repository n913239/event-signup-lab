# Task
在 http://localhost:5173 活動報名網站上，以一般會員帳號登入（member@example.com / password123），進入「秋季音樂會」活動列表，使用「一般」票種保留一個座位、確認訂單，最後到「我的票券」確認票券存在且金額與資料庫吻合。

# Critical Points
- [x] CP1: 以 member@example.com / password123 成功登入（導航列出現「登出」按鈕，顯示會員狀態）
- [x] CP2: 從活動列表找到並進入「秋季音樂會」活動頁面（URL `#/events/ev-1`）
- [x] CP3: 在票種選擇中看到「一般」票種，且票價為 NT$10,000（price_cents=100,000，× 10 為新臺幣）
- [x] CP4: 成功選擇座位「A1」（舞台區域），點擊「保留 X 席」
- [x] CP5: 確認訂單頁面顯示 NT$10,000（原價，無折扣）→ 導航至 `#/tickets`
- [x] CP6: 「我的票券」頁面確認：「秋季音樂會 confirmed」，A1 一般 NT$10,000，總計 NT$10,000

# Results
| 項目 | 值 |
|---|---|
| 活動 ID | ev-1 (秋季音樂會) |
| 票種 | tt-general (一般) |
| price_cents (seed.sql) | 100,000 |
| 票面價 | NT$10,000 (÷10 為十進位新臺幣) |
| 座位號 | A1（舞台欄位 A） |
| 小計 | NT$10,000（無折扣） |
| 總計 | NT$10,000 |
| 確認時間 | 2026/10/9 12:49:00 |
| 票券狀態 | confirmed |

# Output Files
- Exploration screenshots: `screenshots/explore_0_homepage.png` ~ `explore_6_order_confirmed.png`
- Final screenshots: `screenshots/final_seat_selection.png`, `final_seat_selected.png`, `final_hold_page.png`, `final_order_confirmed.png`, `final_tickets_page.png`
- ARIA snapshot: `screenshots/tickets_aria_snapshot.txt`
