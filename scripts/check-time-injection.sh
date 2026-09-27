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

# 2026-09-27 補盲區(Day 24):AI 版 JWT 在 routes 裡自己 Date.now(),上面那段只掃 domain,是綠的 ——
# 測試用假時鐘推 15 分鐘 / 30 天,它看不到,是測試碰巧抓到的。本專案的規矩更嚴:
# 讀時鐘只准在兩個入口 —— src/app.js(注入 now,routes 一律 c.get('now'))與 src/worker.js(Cron)。
# 同一條也擋兩種「看不見的時鐘」:
#   · SQL 自己取時間(unixepoch()、datetime('now')、CURRENT_TIMESTAMP)—— Day 22 AI 版 schema 的寫法
#   · hono/jwt:它的 verify 內部自己 Date.now() 檢查 exp(hono 4.13.5 utils/jwt/jwt.js),注入的時間管不到它
export SCAN_EXCLUDE_FILE="src/app.js src/worker.js"
if ! scan "src 內讀時鐘" 'Date\.now|new[[:space:]]+Date[[:space:]]*\([[:space:]]*\)|new[[:space:]]+Date([^A-Za-z_(]|$)|[^A-Za-z_]Date\(\)|performance\.now|Temporal\.Now|unixepoch[[:space:]]*\(|datetime[[:space:]]*\([[:space:]]*.now.|CURRENT_TIMESTAMP|hono/jwt' src; then
  echo ""
  echo "❌ app.js / worker.js 以外的地方自己讀了時鐘"
  echo "   routes 用 c.get('now'),lib 收 now 參數;SQL 的時間用 ? 綁進去"
  echo "   hono/jwt 的 verify 會自己讀時鐘 —— 用 src/lib/jwt.js(收 now 參數)"
  exit 1
fi
echo "✅ 讀時鐘只在 app.js / worker.js 兩個入口"
