#!/bin/sh
# 金額路徑不得出現浮點運算。
# Day 25 的教訓:顯示轉換(分→元,要 /100)一律放 src/presentation/,本腳本不掃那裡。
set -e
. "$(dirname "$0")/_lib.sh"

FLOAT='parseFloat|toFixed\(|\* *[01]\.[0-9]|\bfloat\b|\bREAL\b|\bNUMERIC\b|\bDOUBLE\b|\bDECIMAL\b'
# 2026-09-10:整數百分比算法 Math.floor((c * pct + 50) / 100) 是規格認可的
# 唯一寫法(見 docs/spec.md 折扣段),它必然含 /100 —— 所以 /100 只在
# 「同一行沒有取整函式」時才算違規。裸的 c / 100 仍然擋。
DIV='/ *100([^0-9]|$)'
DIV_OK='Math\.(floor|trunc|ceil)'

export SCAN_EXCLUDE=presentation
if ! scan "金額浮點" "$FLOAT" src; then
  echo ""; echo "❌ 金額路徑出現浮點運算 —— 一律用整數(最小單位)"; exit 1
fi
if ! scan "金額除法" "$DIV" src > /tmp/_div_hits 2>&1; then
  if grep -vE "$DIV_OK" /tmp/_div_hits | grep -q .; then
    grep -vE "$DIV_OK" /tmp/_div_hits
    echo ""
    echo "❌ 金額路徑出現裸的 /100 —— 顯示轉換應放 src/presentation/;"
    echo "   整數百分比要寫成 Math.floor((cents * pct + 50) / 100)"
    rm -f /tmp/_div_hits; exit 1
  fi
fi
rm -f /tmp/_div_hits

# 2026-09-27(T046):web 端也要管。web 的分 → 元只准在 web/src/lib/money.js。
export SCAN_EXCLUDE= SCAN_EXCLUDE_FILE=web/src/lib/money.js
if ! scan "web 金額浮點" "$FLOAT" web/src; then
  echo ""; echo "❌ web 出現浮點運算 —— 金額顯示一律經 web/src/lib/money.js"; exit 1
fi
if ! scan "web 金額除法" "$DIV" web/src; then
  echo ""; echo "❌ web 出現裸的 /100 —— 分 → 元只准在 web/src/lib/money.js"; exit 1
fi
echo "✅ 金額路徑零浮點(src + web/src)"
