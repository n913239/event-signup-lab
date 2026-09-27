I added 5 new tasks (T077–T081) under a new `## Phase 9: Convergence` section at the end of `specs/001-event-signup-full/tasks.md`. Nothing else was changed: no code, and no edits to spec.md or plan.md.

The implementation is mostly done. All 220 tests pass, the 5 checks and `self-test.sh` are green, and every one of the 18 endpoints is implemented. The gaps are mainly tests that don't yet check what the spec requires, plus two small behaviour gaps.

## Convergence Findings

| ID | Gap Type | Severity | Source | Evidence | Remaining Work |
|----|----------|----------|--------|----------|----------------|
| F1 | partial | HIGH | SC-004 | The race test at `tests/concurrency.test.js:76` only checks that the 5 runs give the same result. It never checks your rule that the original holder's confirm always loses at the moment of expiry. The code does behave that way. | T077: assert that the confirm returns 409 and the seat does not go to the original holder |
| F2 | partial | HIGH | FR-034, US1-AC11, FR-035 | T034 is ticked but `tests/worker.test.js` doesn't exist. Neither the cleanup run on its own nor the timed cleanup job has a test. The quota return when the cleanup expires a hold also has no test. | T078 |
| F3 | contradicts | MEDIUM | SC-003 | The open task T051 still expects the smoke test to assert 314000. That is the old stacked-discount total; quickstart now says 360000 (early bird wins). | T079 |
| F4 | partial | LOW | FR-043 (H7) | If two confirms for the same hold arrive at once, the loser gets 409 `hold_expired` instead of the same order. | T080 |
| F5 | partial | LOW | FR-013 | `PATCH /events/:id` updates the event first, then each ticket type separately. If a later ticket type is rejected, the API returns 409 but the earlier changes are already saved. | T081 |

**What was checked:**
- **Requirements:** 44 FRs, 11 SCs, and the acceptance scenarios for US1–US5 (18 + 9 + 8 + 7 + 4).
- **Plan:** 11 implementation steps and the directory layout.
- **Constitution:** all 5 rules. No violations; the 5 checks and `self-test.sh` pass.
- **Findings by type:** 0 missing, 4 partial, 1 contradicts, 0 unrequested.
- **Findings by severity:** 0 critical, 2 high, 1 medium, 2 low.

These existing unchecked tasks still cover their own work, so I didn't add duplicates:
- **T051:** `smoke.sh` is still an empty stub.
- **T053:** `race.sh` sends `{"seat_no":…}` with a single token, which doesn't match the API contract. Fix this when you fill it in.
- **T055–T060:** the cross-client data comparison and read-count measurement (SC-007/008), `verified.md`, the rule 5 note in the constitution, README, the CI ledger, and the final all-green check.

**Next step:** run `/speckit-implement` to do T077–T081. Following the CLAUDE.md rule, T077, T078, T080 and T081 each start with a failing test. A follow-up converge run should then find nothing left in these areas. `.specify/extensions.yml` doesn't exist, so no hooks ran before or after.

The claude.ai Microsoft 365 connector needs authorization in your claude.ai connector settings before it can be used. It wasn't needed for this task.