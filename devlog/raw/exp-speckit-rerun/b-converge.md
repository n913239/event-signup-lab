The implementation hasn't converged yet. I added 11 tasks (T061–T071) under a new **Phase 9: Convergence** at the end of `specs/001-event-signup-full/tasks.md`. Nothing else was changed, and nothing is committed.

**Setup note:** `check-prerequisites.sh` couldn't work out which feature to check, because this worktree is on a detached HEAD. There is only one feature (`specs/001-event-signup-full`), so I set it by hand with `SPECIFY_FEATURE_DIRECTORY`.

**The code itself is in good shape.** All 214 tests pass, the 5 rule checks (`check:all`) pass, `self-test.sh` passes, and nothing breaks the 5 hard rules.

**What's out of date is the feature spec, not the code.** `specs/.../spec.md` says `docs/spec.md` is the single source of truth. On 2026-09-27 the author changed several rules there, and the code follows them, but `spec.md` and `plan.md` still describe the old ones:
- Discounts no longer stack; each order gets only the single best one. The spec still says stacking, with the 71000 example.
- An invalid promo code is now sometimes ignored instead of always getting a 4xx (revised C8).
- Early bird is judged at the time the hold was created (M1).
- A new 18th endpoint, `POST /holds/:id/quote` (the spec still says 17).
- Login lockout, while the spec still says there's no rate limit.
- New hold rules: at most 10 seats per hold (H1), seats returned on cancel/expiry (H4), confirming twice returns the same order (H7), a used code can be reused after cancelling (M2).

T061–T063 and T065–T067 copy these decisions into `spec.md` and `plan.md`. They don't revert the code.

**Code and test gaps:**
- **T064:** logout without a body returns 204, but T035 expects 400.
- **T069:** the smoke test's expected total of 314000 assumes stacking, so it needs recomputing first. `smoke.sh` is also still an empty stub.
- **T070:** nothing tests that the scheduled job calls `sweepExpired`.

**Two need your call before `/speckit-implement` can finish them:**
- **T068:** the web page now shows error codes as friendly Chinese messages, which conflicts with "error messages stay unfriendly" in the non-goals. Either keep them and update the non-goals and spec, or go back to raw codes.
- **T071:** iOS only caches your tickets for offline use; the events list isn't cached. Either add that cache or narrow US4/AC4 to tickets only.

I didn't duplicate tasks that are already open (T035, T037, T051–T060, with T052 partly done); `/speckit-implement` will pick those up as they are.

**Next step:** run `/speckit-implement`. Once these tasks are done, another converge run should find little or nothing left.