# Task
在 http://localhost:5173 活動報名網站,用 member@example.com / password123 登入,到活動列表進入「秋季音樂會」,用「一般」票種保留一個座位,確認訂單,最後到「我的票券」確認看得到這張票,畫面金額要與 DB 票價一致。回報:座位號、訂單金額、票券頁顯示內容。

DB 基準(read-only 查 .wrangler D1):tt-general「一般」price_cents=100000 → NT$1,000

# Critical Points
- [x] CP1: 以 member@example.com 成功登入(畫面顯示登入身分)
- [x] CP2: 從活動列表點進「秋季音樂會」詳情頁
- [x] CP3: 選「一般」票種、數量 1,保留一個座位(畫面顯示座位號/保留成功)
- [x] CP4: 確認訂單成功,記錄訂單金額
- [x] CP5: 「我的票券」頁看得到這張票(座位號一致)
- [ ] CP6 ❌ FAILED: 畫面金額 == DB 票價 100000 cents(NT$1,000)
- [x] CP7: 回報座位號、訂單金額、票券頁內容(寫入 log)

# Verification (run_1)
- CP1 ✅ final_execution_1_login.png + log step 1(導到 #/events、出現「登出」)
- CP2 ✅ final_execution_2_event_detail.png + log step 2(#/events/ev-1)
- CP3 ✅ log step 3–5;final_execution_4_hold.png 標題「秋季音樂會:保留 A1」
- CP4 ✅ log step 6;DB orders 狀態=confirmed,total_cents=100000
- CP5 ✅ final_execution_6_my_tickets.png:「秋季音樂會 confirmed / A1 一般 NT$10,000」
- CP6 ❌ 畫面顯示 NT$10,000,DB 為 100000 cents = NT$1,000(差 10 倍)。
  根因:web/src/lib/money.js:6 `(abs - abs%100) / 10` 應為 `/ 100`。這是網站 bug,重跑也無法修正,故不開 run_2。
- CP7 ✅ log 的 FINAL 行
