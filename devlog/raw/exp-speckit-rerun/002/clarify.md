All 42 answers are now in `specs/001-event-signup-full/spec.md` and no [NEEDS CLARIFICATION] markers are left. `docs/` is unchanged and nothing is committed.

I checked each answer against the current code and tests. Where an answer disagrees with the repo, the spec follows your answer and marks the spot 【待作者確認】 with the difference. There are three such spots:

| Q | Your answer | What the repo does now |
|---|---|---|
| Q11 | Free ticket type + an invalid promo code → 409 | Only a code that doesn't exist gets 409. A code that exists but is invalid is ignored and the order is created (201). |
| Q26 | `mine` means only seats in your own active hold | Your own **confirmed** seats also show as `mine` |
| Q24 | No automatic switch to `finished` (you marked this for confirmation) | Matches: the scheduled job only clears expired holds |

The other 39 answers match the repo, but many have no test pinning them. `spec-writeback.md` notes, item by item, which are tested and which are only implemented.

**The three "empty markers"**
- They aren't questions. They are the `[NEEDS CLARIFICATION]` wording quoted in the Input line and in the two explanatory paragraphs at the top and bottom of the spec (there is no Actors section).
- I kept the Input line as your original wording and rewrote the other two to describe how this round was answered. Nothing was left that I couldn't handle.

**`spec-writeback.md`** (for you to apply to `docs/spec.md` yourself)
- **Section 1:** the Q9 contradiction, with suggested replacement text.
- **Section 2:** the three items above that need your decision.
- **Section 3:** the other answers, arranged by which section of `docs/spec.md` they belong in.

It also lists four problems I found along the way:
- `openapi.yaml` allows up to 100 seats per hold (`seat_nos maxItems: 100`), but the rule is 10.
- iOS gets its thousands separator from the device's locale settings, so it may not be a comma. That could break "web and iOS show the same data".
- The iOS event list only ever asks for events that are on sale.
- The "my tickets" read count (Q44) has never actually been measured.

**How I ran it**
- **Question limit:** normally this step asks at most five questions, one at a time. You answered all 42 at once, so the Clarifications section has 42 entries (Q3–Q44, your numbering).
- **Where things changed:** Clarifications, the six user stories, Edge Cases, the requirements (error code table in FR-090), Key Entities, SC-005 and SC-009, and Assumptions. Implementation details from the answers (Cron, epoch milliseconds, file paths, the database trigger) went into the "hand to plan" list at the end rather than the main text.
- **Checklist:** 12/16 → 16/16 now pass. That's no markers left, requirements unambiguous, clear acceptance criteria, and meets the success criteria. The Notes section still says 42 markers remain, because this step only allows flipping checkboxes. You'll need to edit that paragraph by hand.

There's no `.specify/extensions.yml`, so no hooks ran.

| Area | Status |
|---|---|
| Scope, roles, data model, state transitions | Resolved |
| User flows, error and empty states, display format | Resolved |
| Security (login tokens, lockout, 403 vs 404) | Resolved |
| Edge cases, error handling, concurrency | Resolved |
| Observability (read count) | Resolved: you chose "record the number, no target" |
| Performance, scale | Clear: out of scope (non-goal 14) |
| The three 【待作者確認】 items | Outstanding: only you can decide these |

You can go on to `/speckit-plan`. I'd decide Q11 and Q26 first, though: whichever way you go, either the code or the spec has to change, and it's simpler before the plan is written.