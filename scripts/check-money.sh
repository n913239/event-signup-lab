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

# 2026-09-27(spec-kit analyze D1):iOS 也要管。Swift 的分 → 元只准在 Tickets/Money.swift,
# 其他 Swift 檔出現 Double / Float / Decimal 或裸的 /100 一律紅燈。
# 時間的 TimeInterval(ms) / 1000 不會中:它不是 /100,也沒有這三個型別字。
SWIFT_FLOAT='\b(Double|Float|CGFloat|Decimal)\b'
export SCAN_EXCLUDE_FILE=Tickets/Money.swift
if ! scan "iOS 金額浮點" "$SWIFT_FLOAT" ios/EventSignup/Sources ios/App; then
  echo ""; echo "❌ iOS 出現浮點型別 —— 金額顯示一律經 Tickets/Money.swift"; exit 1
fi
if ! scan "iOS 金額除法" "$DIV" ios/EventSignup/Sources ios/App; then
  echo ""; echo "❌ iOS 出現裸的 /100 —— 分 → 元只准在 Tickets/Money.swift"; exit 1
fi
# 2026-10-08(Day 28 補實驗 exp-07):Swift 的金額格式化不准跟裝置語系走 —— 連 Money.swift 也不例外。
# c7cfe38 的第一版用 NumberFormatter,在 zh_TW 的開發機上共用向量 14/14 綠,de_DE 下紅 5 組
# (NT$9.999.99);測試在開發機的語系下抓不到,所以這一條交給靜態檢查。日期的 .formatted(date:…) 不擋。
unset SCAN_EXCLUDE_FILE
SWIFT_LOCALE='NumberFormatter|\.formatted\( *\.(currency|number)|\.currency\(code:'
if ! scan "iOS 金額格式跟語系走" "$SWIFT_LOCALE" ios/EventSignup/Sources ios/App; then
  echo ""; echo "❌ iOS 金額用了跟裝置語系走的格式化 —— 千分位固定逗號,在 Tickets/Money.swift 自己拆"; exit 1
fi
echo "✅ 金額路徑零浮點(src + web/src + iOS),iOS 金額格式不跟語系走"
