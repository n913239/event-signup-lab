I synced principle II into `.specify/memory/constitution.md` and bumped the version from **2.0.0 → 3.0.0**. That's the only file I changed.

## What changed

- **Principle II: "時間是參數,不是副作用"** (heading unchanged): I replaced the old sentence "取現在時間是 routes / worker 的責任" with the new wording from `CLAUDE.md` hard rule 2, copied word for word:
  - Only two places may read the clock: `src/app.js` (injects `now`; routes always use `c.get('now')`) and `src/worker.js` (Cron).
  - SQL never gets the time itself (no `unixepoch()` etc.); times are bound in with `?`.
  - `hono/jwt` is not used, because its verify reads the clock internally.
- **New note under the principle:** it records the 2026-09-27 tightening. The judge used to scan only `src/domain/`. It now scans all of `src/` except the two entry files, and also blocks `unixepoch()`, `datetime('now')`, `CURRENT_TIMESTAMP` and `hono/jwt`. `self-test.sh` gained probes that must go red and probes that must stay green (no false alarms).
- **Judge table:** unchanged, since the judge is still `scripts/check-time-injection.sh`.
- **Sync Impact Report:** added as an HTML comment at the top of the file. It's for review only and should be deleted before you commit.
- **Dates:** `Last Amended` stays 2026-09-27 and `Ratified` stays 2026-09-14.

## Why 3.0.0 and not a minor bump

The constitution's own version rule says MAJOR means "移除或改寫既有原則" (removing or rewriting an existing principle). After this tightening, code that used to comply now fails: a `Date.now()` inside routes, or `unixepoch()` in SQL. That's an incompatible rewrite, not a new principle, so it doesn't fit MINOR.

If you'd rather treat "tightening" as a MINOR expansion, just change it to 2.1.0.

## Checks

- No leftover `[PLACEHOLDER]` tokens and no trailing whitespace.
- I ran `scripts/check-time-injection.sh` against the current working tree and both checks passed.
- I did not run `scripts/self-test.sh`; I only read its diff to confirm the new probes are there.

## Suggested commit message

The hook doesn't commit anything by itself, and the working tree still has uncommitted changes to `CLAUDE.md` and three `scripts/` files. Following your "one change, one commit" rule, it makes sense to commit those first, then the constitution:

```
憲法同步硬規則 2 收緊(v2.0.0 → v3.0.0):讀時鐘只准在 src/app.js 與 src/worker.js;SQL 不自己取時間;不用 hono/jwt。改寫既有原則 = MAJOR
```

`.specify/extensions.yml` doesn't exist, so there were no hooks to run before or after the update.