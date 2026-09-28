# Task
在 http://localhost:5173 活動報名網站,用 member 帳號(member@example.com / password123,取自 seed.sql 第 2 行註解)登入,到活動列表進入「秋季音樂會」,用「一般」票種保留一個座位,確認訂單,再到「我的票券」確認看得到這張票,且畫面金額與資料庫票價一致。回報座位號、訂單金額、票券頁顯示內容。

# Critical Points
- [x] CP1: 以 member@example.com 登入成功(畫面顯示已登入身分) — log step1 + shot 1 (登出 button)
- [x] CP2: 從活動列表點進「秋季音樂會」活動頁 — log step2 url #/events/ev-1
- [x] CP3: 選擇「一般」票種並保留恰好 1 個座位(記錄座位號) — log step3-5, shot 3「保留 A2」
- [x] CP4: 確認訂單成功(記錄訂單金額) — log step6 + DB order confirmed
- [x] CP5: 「我的票券」頁看得到這張票(座位號/活動吻合),記錄顯示內容 — shot 4 / log step7, A2 card
- [ ] CP6 (FAILED — site bug): 畫面金額 == 資料庫中「秋季音樂會」「一般」票種票價(event-db 查詢)

  CP6 evidence: screen NT$10,000 vs DB price_cents 100000 (NT$1,000); web/src/lib/money.js uses /10
