#!/bin/sh
# 簽章比對必須是常數時間。全系列唯一「沒有任何測試會為它變紅」的規則。
# ⚠️ pattern 必須雙向 —— v3 的單向版抓不到 (expected !== signature)。
set -e
. "$(dirname "$0")/_lib.sh"

# 2026-09-10 擴大:第一版只認變數名剛好叫 signature、而且只認三等號。
# expected !== sig / expected != signature / expectedSig === providedSig
# / localeCompare(signature) === 0 全都漏 —— 而這是 Day 24 那條「沒有任何
# 測試會為它變紅」的規則的唯一裁判。
SIGVAR='(sig|signature|expected|expectedsig|expectedsignature|computed|computedsig|mac|hmac|digest|providedsig)[a-z0-9_]*'
export SCAN_ICASE=1
if ! scan "簽章比對" "([[:space:]]|^)$SIGVAR[[:space:]]*[!=]=|[!=]=[[:space:]]*$SIGVAR([^a-z0-9_]|\$)|localecompare\(" src; then
  echo ""
  echo "❌ 簽章用了字串比對"
  echo "   改用 crypto.subtle.verify('HMAC', key, sigBytes, dataBytes)"
  exit 1
fi
echo "✅ 沒有自己重算簽章再字串比對"
