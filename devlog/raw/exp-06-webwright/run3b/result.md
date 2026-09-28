cost=0.7434982 turns=25 ms=251264

I booked the ticket, but the amounts don't match: the site shows NT$10,000, while the database has the 一般 ticket at NT$1,000. So the booking worked, and the price check failed.

**What you asked for**
- **Seat:** A2 (秋季音樂會, 一般 ticket, 1 seat)
- **Order amount on screen:** NT$10,000 (原價 NT$10,000, no discount, 應付 NT$10,000)
- **What the 我的票券 page shows for this ticket:**
  ```
  秋季音樂會  confirmed
  A2 一般 NT$10,000
  小計 NT$10,000・無折扣
  總計 NT$10,000・確認於 2026/9/28 10:34:00
  [QR code] [取消訂單]
  ```

**Why the amounts don't match**
- In the database (event-db), `ticket_types.tt-general` has `price_cents = 100000`, which is NT$1,000. The new order `43bad7d9…` stores `unit_price_cents` and `total_cents` as 100000, so the stored data is right.
- The frontend displays it 10 times too high. `formatCents` in `es-web-lab/web/src/lib/money.js` divides by `10` instead of `100`. The backend `src/presentation/money.js` and the spec (T039: 100000 → "1,000") both divide by 100, so the frontend is the one that's wrong.
- Every amount on the site is affected: the ticket dropdown, the hold quote and the ticket list. I did not change any code.

**Other notes**
- 我的票券 has a second confirmed order: seat A1, confirmed at 10:29:41. It already existed before my run; my exploration never reserved a seat. If it's leftover test data, you can cancel it yourself.
- I ran the final script once, in `final_runs/run_1`. Every run books another real seat, so I didn't run it again.
- As instructed, I used Chrome (`channel="chrome"`) instead of Firefox.

Everything is in `outputs/member_ticket/`:
- `plan.md`: checks 1–5 are ticked; the price check is marked failed, with evidence.
- `final_runs/run_1/final_script_log.txt`
- `final_runs/run_1/screenshots/`: 4 screenshots