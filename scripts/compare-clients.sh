#!/bin/bash
# SC-007:同一個帳號、同一個時間點,curl 與 iOS(產生的 client 解碼後再編回 JSON)對
# GET /events?status=on_sale 與 GET /orders 逐欄比。web 不另外比:web/src/api.js 直接用 res.json(),不轉換。
# 用法:BASE_URL=https://… ACCESS_TOKEN=… bash scripts/compare-clients.sh
# server_now 每次請求都不同,比之前拿掉;其餘欄位一個都不准差。
# null 與「沒有這個 key」視為相同:Swift 的 JSONEncoder 遇到 nil 的 Optional 直接省略 key(第一次實跑 promo_code: null 因此不見),
# iOS 解碼後的值仍是 nil —— 這是再編碼的產物,不是資料差異。除此之外不做任何正規化。
set -e
BASE="${BASE_URL:?請設 BASE_URL}"; TOKEN="${ACCESS_TOKEN:?請設 ACCESS_TOKEN}"
OUT=$(mktemp -d); trap 'rm -rf "$OUT"' EXIT
cd "$(dirname "$0")/.."
curl -s "$BASE/events?status=on_sale" -H "authorization: Bearer $TOKEN" > "$OUT/curl-events.json"
curl -s "$BASE/orders" -H "authorization: Bearer $TOKEN" > "$OUT/curl-orders.json"
(cd ios/EventSignup && LIVE_BASE_URL="$BASE" LIVE_ACCESS_TOKEN="$TOKEN" LIVE_OUT_DIR="$OUT" swift test --filter dumpDecodedLiveResponses > "$OUT/swift.log" 2>&1) \
  || { tail -20 "$OUT/swift.log"; exit 1; }
FAIL=0
for k in events orders; do
  n=$(jq ".$k | length" "$OUT/curl-$k.json")
  if diff <(jq -S "del(.server_now) | del(..|nulls)" "$OUT/curl-$k.json") <(jq -S "del(.server_now) | del(..|nulls)" "$OUT/ios-$k.json") > "$OUT/$k.diff"; then
    echo "✅ GET /$k:$n 筆,curl 與 iOS 逐欄相同(欄位數 $(jq "[.$k[] | paths(scalars)] | length" "$OUT/curl-$k.json"))"
  else
    echo "🔴 GET /$k 不一致:"; head -30 "$OUT/$k.diff"; FAIL=1
  fi
done
exit $FAIL
