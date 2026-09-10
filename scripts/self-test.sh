#!/bin/sh
# 尺要先被驗過 —— 每一支靜態檢查都必須證明它「抓得到」,不只是「會過」。
#
# 出處:2026-09-04,三支檢查因為 rg 在 sh 下不存在而全部靜默通過。
#      一支從不亮紅燈的檢查,跟沒有檢查是同一件事。
set -e
cd "$(dirname "$0")/.."

PROBE=src/domain/__self_test_probe.js
PROBE_LIB=src/lib/__self_test_probe.js
FAIL=0
cleanup() { rm -f "$PROBE" "$PROBE_LIB"; rmdir src/lib 2>/dev/null || true; }
trap cleanup EXIT

# check <名稱> <腳本> <程式碼> [探針路徑]
# 第四個參數 2026-09-10 加的:探針原本一律寫進 src/domain/,所以只驗得到
# 檢查在 src/domain 抓不抓得到 —— 而三支檢查當時根本沒掃 src/lib、src/auth。
# 自我測試照不到的地方,就是尺伸不到的地方。
check() {
  _name="$1"; _script="$2"; _code="$3"; _probe="${4:-$PROBE}"
  mkdir -p "$(dirname "$_probe")"
  printf '%s\n' "$_code" > "$_probe"
  if sh "scripts/$_script" >/dev/null 2>&1; then
    echo "🔴 $_name — 沒抓到違規(檢查壞了)"; FAIL=1
  else
    echo "✅ $_name — 抓得到"
  fi
  rm -f "$_probe"
}

# 反向探針:合法的寫法**不可以**被擋下。檢查抓得太寬跟抓不到一樣糟 ——
# 一支會對正常程式碼亮紅燈的閘門,最後一定會被 --no-verify 繞過去。
allow() {
  _name="$1"; _script="$2"; _code="$3"; _probe="${4:-$PROBE}"
  mkdir -p "$(dirname "$_probe")"
  printf '%s\n' "$_code" > "$_probe"
  if sh "scripts/$_script" >/dev/null 2>&1; then
    echo "✅ $_name — 沒誤報"
  else
    echo "🔴 $_name — 誤報了(合法寫法被擋)"; FAIL=1
  fi
  rm -f "$_probe"
}

echo "=== 靜態檢查自我測試 ==="
check "金額浮點  " check-money.sh          'export const t = (i) => parseFloat(i.price)'
check "金額除法  " check-money.sh          'export const t = (c) => c / 100'
check "時間副作用" check-time-injection.sh 'export const ok = (e) => Date.now() < e.deadline_at'
check "簽章比對 A" check-jwt-timing.sh     'export const v = (expected, signature) => expected !== signature'
check "簽章比對 B" check-jwt-timing.sh     'export const v = (expected, signature) => signature !== expected'
check "併發無 WHERE" check-concurrency.sh    "export const t = (db) => db.prepare(\`UPDATE reservations SET status = 'x'\`).run()"
check "併發沒看 rows" check-concurrency.sh   "export const t = (db) => db.prepare('UPDATE events SET remaining = remaining - 1 WHERE id = ? AND remaining > 0').run()"
check "金額被 UPDATE" check-price-snapshot.sh "export const t = (db) => db.prepare('UPDATE orders SET total_cents = ? WHERE id = ?').run()"
check "盲區:簽章比對在 src/lib" check-jwt-timing.sh "export const v = (expected, signature) => expected !== signature" "$PROBE_LIB"
check "盲區:parseFloat 在 src/lib" check-money.sh          "export const t = (i) => parseFloat(i.price)" "$PROBE_LIB"
allow "合法改價不誤報" check-price-snapshot.sh "export const t = (db,c,i) => db.prepare('UPDATE ticket_types SET price_cents = ? WHERE id = ?').run()"
check "金額夾在多欄中" check-price-snapshot.sh "export const t = (db) => db.prepare(\`UPDATE orders SET status = 'confirmed', amount_cents = 0 WHERE id = ?\`).run()"


# ── 2026-09-10 大批補測資:下面每一筆都是驗證時實際漏掉或誤報過的
echo ""
echo "--- 漏網(這些以前抓不到)---"
check "JWT 二等號"      check-jwt-timing.sh "export const v = (expected, sig) => expected != sig"
check "JWT 變數名不叫 signature" check-jwt-timing.sh "export const v = (expectedSig, providedSig) => expectedSig === providedSig"
check "JWT localeCompare"  check-jwt-timing.sh "export const v = (a, signature) => a.localeCompare(signature) === 0"
check "new Date 不帶括號"  check-time-injection.sh "export const ok = (e) => new Date < e.deadline_at"
check "Date.now 當值傳"    check-time-injection.sh "const clock = Date.now; export const ok = (e) => clock() < e.deadline_at"
check "Date() 直接呼叫"    check-time-injection.sh "export const ok = (e) => Date() < e.deadline_at"
check "performance.now"   check-time-injection.sh "export const ok = (e) => performance.now() < e.deadline_at"
check "UPDATE OR IGNORE 訂單" check-price-snapshot.sh "export const f=(db)=>db.prepare('UPDATE OR IGNORE orders SET total_cents = ? WHERE id = ?').run()"
check "REPLACE INTO 訂單"  check-price-snapshot.sh "export const f=(db)=>db.prepare('REPLACE INTO orders (id,total_cents) VALUES (?,?)').run()"
check "UPSERT 改訂單金額"   check-price-snapshot.sh "export const f=(db)=>db.prepare('INSERT INTO orders (id,total_cents) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET total_cents = excluded.total_cents').run()"
check "註解假裝有 changes"  check-concurrency.sh "// r.meta.changes tells you if it worked
export const f=(db)=>db.prepare('UPDATE events SET x=1 WHERE id=?').run()"

echo ""
echo "--- 誤報(這些以前會被亂擋)---"
allow "英文註解 update"     check-concurrency.sh "// update remaining count after confirm
export const r = (e) => e.capacity - e.sold"
allow "區塊註解 Update"     check-concurrency.sh "/** Update the aggregate */
export const agg = (x) => x"
allow "錯誤訊息字串"        check-concurrency.sh "export const msg = 'UPDATE failed for ' + id"
allow "解構 const changes"  check-concurrency.sh "export async function f(db){const r=await db.prepare('UPDATE e SET n=n-1 WHERE id=? AND n>0').run();const { changes } = r.meta;return changes===1}"
allow "price_locked 非金額" check-price-snapshot.sh "export const f=(db)=>db.prepare('UPDATE orders SET status = ?, price_locked = 1 WHERE id = ?').run()"
allow "total_seats 非金額"  check-price-snapshot.sh "export const f=(db)=>db.prepare('UPDATE events SET total_seats = ? WHERE id = ?').run()"
allow "註解提到簽章比對"     check-jwt-timing.sh "// never do expected !== signature
export const v = (k,s,d) => crypto.subtle.verify('HMAC', k, s, d)"
allow "註解提到 Date.now"   check-time-injection.sh "// don't call Date.now() here — now comes in as a parameter
export const ok = (e, now) => now < e.deadline_at"
allow "new Date(now) 帶參數" check-time-injection.sh "export const at = (now) => new Date(now).toISOString()"
allow "規格認可的整數百分比"  check-money.sh "export const p = (c, pct) => Math.floor((c * (100 - pct) + 50) / 100)"
check "浮點乘法 c * 0.9"    check-money.sh "export const p = (c) => Math.round(c * 0.9)"
check "schema NUMERIC 型別" check-money.sh "total_cents NUMERIC" "src/domain/__probe.sql"

echo ""
echo "=== 乾淨狀態應全過 ==="
sh scripts/check-money.sh          >/dev/null && echo "✅ 金額"
sh scripts/check-time-injection.sh >/dev/null && echo "✅ 時間"
sh scripts/check-jwt-timing.sh     >/dev/null && echo "✅ 簽章"
sh scripts/check-concurrency.sh    >/dev/null && echo "✅ 併發"
sh scripts/check-price-snapshot.sh >/dev/null && echo "✅ 價格快照"

exit $FAIL
