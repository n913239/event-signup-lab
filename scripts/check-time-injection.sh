#!/bin/sh
# 時間必須是參數,不能是副作用(2026-09-03 A3 實驗的發現)。
# domain 一旦自己取現在時間,「剛好等於開賣 / 剛好等於逾時」就永遠測不到,而測試照樣全綠。
set -e
. "$(dirname "$0")/_lib.sh"

# 2026-09-10 補漏:new Date(不帶括號)、Date.now 當值傳、解構 { now } = Date、
# Date()、performance.now、Temporal.Now —— 全部是合法 JS,第一版都看不到。
if ! scan "時間副作用" 'Date\.now|new[[:space:]]+Date[[:space:]]*\([[:space:]]*\)|new[[:space:]]+Date([^A-Za-z_(]|$)|[^A-Za-z_]Date\(\)|performance\.now|Temporal\.Now' src/domain; then
  echo ""
  echo "❌ domain 層自己取了現在時間"
  echo "   now 要當參數傳進來,例如 canJoin(event, now)"
  echo "   取現在時間是 routes / worker 的責任"
  exit 1
fi
echo "✅ domain 層的時間都是參數"
