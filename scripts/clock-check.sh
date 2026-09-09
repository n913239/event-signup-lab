#!/bin/sh
# 三方時鐘對照:本機 / 伺服器 / 獨立第三方。
# ⚠️ 只進測試腳本,不進產品路徑(非目標清單「不做效能優化」那一條)。
# worldtimeapi.org 已於 2026-08 實測 HTTP 000 掛掉;timeapi.io 可用。
# 零依賴替代:任何網站的 HTTP Date header。
set -e
BASE="${BASE_URL:-http://127.0.0.1:8788}"

echo "本機:      $(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '伺服器:    '; curl -sI "$BASE/" 2>/dev/null | grep -i '^date:' | cut -d' ' -f2- || echo '(未啟動)'
printf '第三方:    '; curl -s --max-time 5 'https://timeapi.io/api/Time/current/zone?timeZone=UTC' 2>/dev/null | grep -o '"dateTime":"[^"]*"' || echo '(取不到)'
printf 'HTTP Date: '; curl -sI --max-time 5 https://www.cloudflare.com 2>/dev/null | grep -i '^date:' | cut -d' ' -f2- || echo '(取不到)'
