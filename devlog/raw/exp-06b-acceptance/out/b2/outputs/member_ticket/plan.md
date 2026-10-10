# Task
在 http://localhost:5173 活動報名網站上，用一般會員帳號登入，到「秋季音樂會」以「一般」票種保留一個座位，確認訂單後至「我的票券」檢查票券內容與金額。

# Critical Points (All Completed)

- [x] **CP1**: 以 member@example.com / password123 成功登入系統。
- [x] **CP2**: 在活動列表找到「秋季音樂會」(`/events/ev-1`) 並進入其頁面。
- [x] **CP3**: 選擇「一般」票種（`price_cents=100000`, 即 NT$10,000）。
- [x] **CP4**: 保留一個座位 (A1) 並完成訂單確認 (`confirmed`)。
- [x] **CP5**: 在「我的票券」頁面看到該張票，畫面金額 (NT$10,000) 與資料庫 `ticket_types.price_cents=100000` 相符。
- [x] **CP6**: 已回報座位號 (A1)、訂單金額 (NT$10,000) 及票券頁完整內容。

## Final Answer Summary

| Field            | Value                                    |
|------------------|------------------------------------------|
| **座位號 (Seat)**| A1                                       |
| **訂單金額**     | NT$10,000                                |
| 票種             | 一般 (General)                           |
| 訂單狀態         | confirmed                                |
| 確認時間         | 2026/10/9 13:15:51                       |

完整報告請見 `final_report.md`，原始碼與截圖於 `final_runs/run_1/`。
