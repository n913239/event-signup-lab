# Task
在 http://localhost:5173 用 member 帳號登入(member@example.com / password123,取自 seed.sql 第 2 行註解),到活動列表進入「秋季音樂會」,用「一般」票種保留一個座位,確認訂單,最後到「我的票券」確認看得到這張票。回報:座位號、訂單金額、票券頁顯示的內容。

# Critical Points
- [x] CP1: 以 member@example.com 登入成功(畫面顯示已登入身分)  — 證據:final_execution_2_logged_in_event_list.png(右上「登出」)+ log step 2
- [x] CP2: 從活動列表進入「秋季音樂會」詳情頁  — 證據:final_execution_3_event_detail.png + log step 3 (#/events/ev-1)
- [x] CP3: 選擇「一般」票種並保留一個座位(記錄座位號)  — 證據:log step 4(票種「一般・NT$10,000」,座位 A1)+ final_execution_5_hold_page.png「秋季音樂會:保留 A1」。註:step 4 截圖中 A1 高亮沒有畫出來,但按鈕文字已是「保留 1 席」
- [x] CP4: 確認訂單成功(記錄訂單金額與狀態)  — 證據:final_execution_5_hold_page.png 應付 NT$10,000 → 按「確認」後跳到 #/tickets,訂單狀態 confirmed
- [x] CP5: 「我的票券」頁看得到這張票(秋季音樂會、座位號與 CP3 一致)  — 證據:final_execution_6_my_tickets.png:秋季音樂會 confirmed / A1 一般 NT$10,000
- [x] CP6: 最終資料(座位號、訂單金額、票券頁內容)寫入 final_script_log.txt  — 證據:final_script_log.txt FINAL_RESPONSE 行
