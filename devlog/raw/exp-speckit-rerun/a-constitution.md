I've updated `.specify/memory/constitution.md` to **v2.0.0**. It was the only file I changed.

**Why a MAJOR bump:** this document's own versioning rule says "MAJOR = 移除或改寫既有原則". Principle I went from one allowed place for 分 → 元 to three. That changes what counts as a violation, so it is a rewrite, not a clarification. Principle V's judge line was rewritten too. Plain semver could arguably call a loosened rule MINOR, but the project's stricter rule takes priority. If you'd rather use 1.1.0, only the Version line and the report need changing.

**What changed, following 7d4963e:**
- **I. Money:** 分 → 元 is now allowed in three places: `src/presentation/`, `web/src/lib/money.js` and `Tickets/Money.swift`, all within `check-money.sh`'s scope. The wording is copied from `CLAUDE.md`.
- **IV. Constant-time comparison:** the rule itself is unchanged. I added a note quoting `docs/spec.md`: JWT edge cases are now decided by the six tests in `tests/jwt.test.js` plus `check-jwt-timing.sh`.
- **V. Price snapshot:** the judges are now `check-price-snapshot.sh` plus `tests/schema.test.js` ⑥. I removed the "only half has a judge" warning, which also removes the outdated "17 條 endpoint". `docs/spec.md` now lists 18, and I confirmed it, but the constitution no longer mentions the count at all.
- **Judge table:** the row for V is updated to match.
- **Non-goals:** the body is unchanged. The "API only returns error codes" note is in the "刻意保留的醜" section of `docs/non-goals.md`, which this constitution deliberately doesn't copy. It doesn't conflict with non-goal 10 (i18n).
- **"建議新增(未採納)":** I removed the item about giving rule V's other half a deadline, because that half now has a judge. The other suggestions still apply and stay.

**Template:** `resolve-template.sh` needed approval and couldn't run in this session. Instead I read `.specify/templates/constitution-template.md` directly. It is the only copy of the template (I found no other layers), and I didn't modify it. There is no `.specify/extensions.yml`, so there were no hooks to run.

**Before committing:** delete the Sync Impact Report comment at the top of the file. There are no remaining TODOs.

Suggested commit message:
```
constitution 同步 7d4963e 升 2.0.0:規則 I 分 → 元改三個允許位置、規則 V 裁判改 check-price-snapshot + schema.test.js ⑥、規則 IV 註明 JWT 由 jwt.test.js 六個測試 + check-jwt-timing 裁定
```