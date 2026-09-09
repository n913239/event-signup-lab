#!/bin/sh
# 尺要先被驗過 —— 每一支靜態檢查都必須證明它「抓得到」,不只是「會過」。
#
# 出處:2026-09-04,三支檢查因為 rg 在 sh 下不存在而全部靜默通過。
#      一支從不亮紅燈的檢查,跟沒有檢查是同一件事。
set -e
cd "$(dirname "$0")/.."

PROBE=src/domain/__self_test_probe.js
FAIL=0
cleanup() { rm -f "$PROBE"; }
trap cleanup EXIT

check() {
  _name="$1"; _script="$2"; _code="$3"
  mkdir -p src/domain
  printf '%s\n' "$_code" > "$PROBE"
  if sh "scripts/$_script" >/dev/null 2>&1; then
    echo "🔴 $_name — 沒抓到違規(檢查壞了)"; FAIL=1
  else
    echo "✅ $_name — 抓得到"
  fi
  rm -f "$PROBE"
}

echo "=== 靜態檢查自我測試 ==="
check "金額浮點  " check-money.sh          'export const t = (i) => parseFloat(i.price)'
check "金額除法  " check-money.sh          'export const t = (c) => c / 100'
check "時間副作用" check-time-injection.sh 'export const ok = (e) => Date.now() < e.deadline_at'
check "簽章比對 A" check-jwt-timing.sh     'export const v = (expected, signature) => expected !== signature'
check "簽章比對 B" check-jwt-timing.sh     'export const v = (expected, signature) => signature !== expected'
check "併發無 WHERE" check-concurrency.sh    "export const t = (db) => db.prepare(\`UPDATE reservations SET status = 'x'\`).run()"
check "併發沒看 rows" check-concurrency.sh   "export const t = (db) => db.prepare('UPDATE events SET remaining = remaining - 1 WHERE id = ? AND remaining > 0').run()"

echo ""
echo "=== 乾淨狀態應全過 ==="
sh scripts/check-money.sh          >/dev/null && echo "✅ 金額"
sh scripts/check-time-injection.sh >/dev/null && echo "✅ 時間"
sh scripts/check-jwt-timing.sh     >/dev/null && echo "✅ 簽章"
sh scripts/check-concurrency.sh    >/dev/null && echo "✅ 併發"

exit $FAIL
