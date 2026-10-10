# Task
在 http://localhost:5173 活動報名網站,用 member@example.com 登入,到活動列表進入「秋季音樂會」,
用「一般」票種保留一個座位,確認訂單,再到「我的票券」確認看得到這張票,且畫面金額與資料庫票價一致。
回報:座位號、訂單金額、票券頁顯示的內容。

# DB baseline (read-only query before run)
ticket_types: tt-general | ev-1 | 一般 | price_cents=100000 | capacity 60 | remaining 60 | no early bird
orders=0, seat_holds=0

# Critical Points
- [x] CP1: 以 member@example.com / password123 登入成功(畫面顯示已登入的會員身分)
- [x] CP2: 從活動列表點進「秋季音樂會」詳情頁
- [x] CP3: 選擇「一般」票種、數量 1,保留(hold)一個座位,畫面顯示座位號
- [x] CP4: 確認訂單成功,畫面顯示訂單金額
- [x] CP5: 「我的票券」頁看得到這張票(秋季音樂會/一般/同一座位號)
- [x] CP6(已驗證,結果=不一致): 畫面上的金額 == DB 票價 price_cents=100000(換算後)且 DB 有對應的 order
- [x] CP7: 記錄最終資料:座位號、訂單金額、票券頁內容

# Verification (run_1)
- CP1: final_execution_1_after_login.png 右上出現「我的票券/登出」;log 中 login API 200, member-1 小明。
- CP2: final_execution_2_events_list.png + log step 3 url=#/events/ev-1。
- CP3: log step 4(一般 tt-general, 座位 A1, 按鈕「保留 1 席」);final_execution_4 標題「秋季音樂會:保留 A1」;DB seat_holds A1 tt-general member-1。
  註:final_execution_3 截圖時 A1 的選取色尚未重繪,但 log 與後續畫面皆證明已選取。
- CP4: log step 6 confirm API 201,status=confirmed,跳轉 #/tickets。
- CP5: final_execution_5_my_tickets.png:秋季音樂會 confirmed / A1 一般 NT$10,000 / 總計 NT$10,000。
- CP6: DB price_cents=100000 = NT$1,000;API total_cents=100000;畫面顯示 NT$10,000 → 不一致(10 倍)。
  原因:web/src/lib/money.js formatCents 用 `/ 10`,應為 `/ 100`。
