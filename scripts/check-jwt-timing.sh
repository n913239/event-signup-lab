#!/bin/sh
# 簽章比對必須是常數時間。全系列唯一「沒有任何測試會為它變紅」的規則。
# ⚠️ pattern 必須雙向 —— v3 的單向版抓不到 (expected !== signature)。
set -e
. "$(dirname "$0")/_lib.sh"

if ! scan "簽章比對" '(signature *[!=]==|[!=]== *signature)' src; then
  echo ""
  echo "❌ 簽章用了字串比對"
  echo "   改用 crypto.subtle.verify('HMAC', key, sigBytes, dataBytes)"
  exit 1
fi
echo "✅ 沒有自己重算簽章再字串比對"
