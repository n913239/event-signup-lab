`specs/001-event-signup-full/tasks.md` is written: 88 tasks. 46 are already done and ticked, and the remaining 42 have suggested dates from 9/28 to 10/13. The "日期 × 里程碑" table is at the end of the file. No code or `docs/` files were changed, and nothing is committed.

**The biggest finding is the timeline.** Per `git log`, almost all the implementation (API, web, iOS, contract, schema) was committed on **09-27**. From 9/17 to 9/26 there are no commits at all, and 9/14–9/16 has only spec-kit files and devlog notes. So the table shows 9/14–9/26 as "specs and experiments" and 9/27 as the day all 18 endpoints were done. It doesn't pretend the work followed the original schedule. There are 16 days left (9/28–10/13), and they hold only missing tests, pending decisions, end-to-end checks and wrap-up.

**How I decided what's done**
- A task is ticked only if a commit matches and the files and behaviour are in `src/` / `tests/`. Each one lists its commit, such as `✅ 09-27 eb5bf59`.
- Deploying the Worker (T074) isn't ticked. A commit mentions testing it live, but I couldn't confirm it's deployed, so it says "可能已完成,請確認".
- The T numbers are new. They don't match the `T0xx` numbers in old commit messages, and the file says so at the top.
- Test status still relies on commit `ec550fa`; I didn't re-run anything.

| Phase | Total | Done | To do |
|---|---|---|---|
| Setup | 8 | 8 | 0 |
| Foundational | 10 | 10 | 0 |
| US1 holds and confirmation (P1, MVP) | 14 | 6 | 8 |
| US2 accounts | 6 | 3 | 3 |
| US3 organizer | 14 | 4 | 10 |
| US4 discounts and quotes | 8 | 3 | 5 |
| US5 my tickets | 5 | 1 | 4 |
| US6 web / iOS | 12 | 6 | 6 |
| Polish | 6 | 0 | 6 |
| Series experiments (outside the spec, from git log) | 5 | 5 | 0 |

**What the remaining 42 are**
- **Missing tests (about 25):** behaviour the code already has but no test pins. Examples: abandoning a hold that's no longer active returning `terminal_state`, a repeat confirm carrying a different promo code, `email_taken`, and a refreshed token's 30 days counting from the refresh.
- **Your decisions (4):** Q11, Q24, Q26 and `/health`, all scheduled for **9/28**. The code changes that depend on them come 10/3–10/5, which leaves a week of slack.
- **Contract fix:** change `seat_nos` `maxItems` from 100 to 10, and add a test that the two copies of `openapi.yaml` are identical.
- **Measurements and end-to-end:** measure `rows_read` for "my tickets" (SC-009), make the iOS thousands separator always a comma, run web and iOS end-to-end, and compare what the two show (SC-008).
- **Two things only you can do:** apply `spec-writeback.md` to `docs/spec.md`, and decide the rule-wording issues from the plan's ⚠️ items.

**How the days are planned**
- Each day gets 2–4 small tasks (about three hours) in the morning; afternoons are for that day's article. Weekends are scheduled too, just lighter.
- 10/12–10/13 have no new work, only verification and wrap-up.
- Tasks that can run in parallel are mostly the tests marked [P] on the same day, going into different `describe` blocks of the same test file.

**How to test each story**
- **US1:** `test:race` plus `holds.test.js`.
- **US2:** `auth.test.js`, the lockout tests and `test:jwt`.
- **US3:** `events.test.js` and `ticket-types.test.js`.
- **US4:** `money.test.js` and `quote.test.js`.
- **US5:** `orders.test.js`.
- **US6:** the manual end-to-end runs in quickstart §3 and §4.

**Format:** every task has a checkbox, an ID and a file path. Tasks in the story phases carry their story label, and Setup, Foundational, Polish and experiment tasks have none. I added `[US3]` to T052, the `/health` decision, so it fits the format.

There's no `.specify/extensions.yml`, so no hooks ran.

**Next:** on 9/28, decide T031, T050, T052 and T056 (Q26, Q24, `/health`, Q11) first. After that you can run `/speckit-analyze` or start on the tasks.