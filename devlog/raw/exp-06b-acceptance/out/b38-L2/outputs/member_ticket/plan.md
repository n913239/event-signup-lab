# Task

在 http://localhost:5173 這個活動報名網站上,用一般會員帳號登入(帳號密碼寫在
<lab>/seed.sql 第 2 行的註解裡,用 member 那個),
到活動列表進入「秋季音樂會」,用「一般」票種保留一個座位,然後確認訂單,
最後到「我的票券」確認看得到這張票,而且畫面上的金額要跟資料庫裡的票價對得上。
回報:座位號、訂單金額、票券頁顯示的內容。

帳號(seed.sql 第 2 行註解,member):member@example.com / password123
DB 票價(seed.sql ticket_types):一般 price_cents=100000 → web/src/lib/money.js 的
formatCents(100000) = "NT$10,000"(VIP=200000 → NT$20,000,本任務不用)。

# Critical Points
- [ ] CP1: 以 member@example.com 成功登入(一般會員),畫面進入 #/events;證據 = URL #/events + nav 出現「登出」鈕(未登入會被跳回 #/login;UI 不顯示暱稱,已查 web/src)
- [ ] CP2: 從活動列表點選進入「秋季音樂會」(URL #/events/ev-1,頁首顯示活動名)
- [ ] CP3: 票種選單 #tt 選擇「一般」(option 文字形如「一般・NT$10,000・剩 N」)
- [ ] CP4: 在座位圖上選中且只選中 1 個 free 座位,保留鈕顯示「保留 1 席」;記錄座位號
- [ ] CP5: 點「保留 N 席」成功建立保留,進入 hold 頁並顯示該座位號
- [ ] CP6: 在 hold 頁點「確認」完成訂單(不填優惠碼),進入 #/tickets
- [ ] CP7: 「我的票券」列出這筆訂單:活動名「秋季音樂會」、該座位號＋「一般」、狀態 confirmed
- [ ] CP8: 畫面金額與 DB 票價一致:hold 頁「原價(1 席)」「應付」= NT$10,000;票券頁單價/小計/總計 = NT$10,000;折扣為「無」(formatCents(price_cents=100000) = NT$10,000)
- [ ] CP9: 最終資料寫入 final_script_log.txt:座位號、訂單金額(NT$10,000)、票券頁顯示內容
