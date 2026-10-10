# Task

在 http://localhost:5173 這個活動報名網站上,用一般會員帳號登入(帳號密碼寫在
<lab>/seed.sql 第 2 行的註解裡,
用 member 那個),到活動列表進入「秋季音樂會」,用「一般」票種保留一個座位,
然後確認訂單,最後到「我的票券」確認看得到這張票,而且畫面上的金額要跟資料庫
裡的票價對得上。回報:座位號、訂單金額、票券頁顯示的內容。

Credentials from seed.sql line 2 comment: `member@example.com` / `password123`
(nickname 小明, role member).

DB ground truth (seed.sql): event ev-1 「秋季音樂會」 on_sale;
ticket type `tt-general` 「一般」 price_cents=100000 (i.e. 1,000.00), capacity 60;
`tt-vip` 「VIP」 price_cents=200000.

# Critical Points
- [ ] CP1: Logged in as the general member (member@example.com, nickname 小明) — UI shows signed-in state.
- [ ] CP2: Entered event 「秋季音樂會」 from the events list (not another event).
- [ ] CP3: Ticket type selected is exactly 「一般」(not VIP), quantity exactly 1 (one seat hold).
- [ ] CP4: Order confirmed — a confirmation/success state with the order (and its seat number + amount) is shown.
- [ ] CP5: 「我的票券」 page shows this ticket (秋季音樂會, 一般 ×1).
- [ ] CP6: On-screen amount equals the DB ticket price for 一般 (100,000 cents = 1,000.00).
- [ ] CP7: Final datum recorded in log and reported: seat number, order amount, ticket-page content.
