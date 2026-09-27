**Outcome: tasks appended.** The convergence check found 4 gaps. One is a violation of a hard rule (constitution rule III). I added 4 tasks as **T082–T085** under a new `## Phase 9: Convergence` at the end of `specs/001-event-signup-full/tasks.md`. I didn't change anything else.

1. **T082 (CRITICAL):** `PATCH /events/:id` checks "ticket-type capacities total ≤ 100" in the app (read, then write), not in SQL. Nothing in the database backs that check up. If someone adds a ticket type at the same moment, the total can go over 100. The fix has to make a violation throw so the whole batch rolls back, because a guard that just updates zero rows doesn't roll back on D1.
2. **T083 (HIGH):** `src/lib/hmac.js` has a `verifyQrPayload` that recomputes the HMAC and compares it itself. The spec says this project only signs QR codes, and any future verifier must use `crypto.subtle.verify`. Only tests call it.
3. **T084 (MEDIUM):** on iOS, logging out while offline clears the tokens and cached tickets anyway, but the server-side refresh token is never revoked. It should keep the user logged in and say a connection is needed.
4. **T085 (LOW):** two database functions have had no callers since T081, `events.update` and `ticketTypes.updateCapacity`.

**Verification:**
- The five static checks and `self-test.sh` pass.
- I did **not** run the vitest suite. This worktree has no `node_modules`, so the test results come from the last commit's "225/225 green", not from me.
- `check-prerequisites.sh` needed approval, so I read the feature directory directly. There's only one, `specs/001-event-signup-full`.
- There's no `.specify/extensions.yml`, so there were no hooks to run.

**Not re-added:** seven Phase 8 tasks are still unchecked (T051, T053, T055, T056, T058, T059, T060). They cover `smoke.sh` and `race.sh`, which are still empty, the SC-007/008 checks, `verified.md`, and the README. T040 asked for `meta.rows_read` to be recorded, but nothing records it yet. T055 covers that.

**Next step:** run `/speckit-implement` to work through T082–T085 and the open Phase 8 tasks, starting with T082: write the gate-based test that fails first, then fix. A second converge run after that should find little or nothing. I haven't committed the `tasks.md` change.