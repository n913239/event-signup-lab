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

echo ""
echo "=== 乾淨狀態應全過 ==="
sh scripts/check-money.sh          >/dev/null && echo "✅ 金額"
sh scripts/check-time-injection.sh >/dev/null && echo "✅ 時間"
sh scripts/check-jwt-timing.sh     >/dev/null && echo "✅ 簽章"
sh scripts/check-concurrency.sh    >/dev/null && echo "✅ 併發"
sh scripts/check-price-snapshot.sh >/dev/null && echo "✅ 價格快照"

exit $FAIL
