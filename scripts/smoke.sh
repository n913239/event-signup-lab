#!/bin/sh
# 全流程煙霧測試(T051):照 specs/001-event-signup-full/quickstart.md 第 3 節,對本機 wrangler dev 跑一遍。
#   註冊 → 登入 → 建活動 → 票種 → 4 座 hold → 帶 WELCOME 確認(擇優選早鳥,360000、WELCOME 沒用掉)
#   → 改價後重讀不變 → 非主辦 PATCH 403 → 取消 → 重 hold A1 → 201
#
# 只准打本機:它用 seed.sql 的 staff@example.com / password123 登入,那組帳密永遠不該存在於遠端。
# 前置:npm run db:init && npm run db:seed && npm run dev
set -e
BASE="${BASE_URL:-http://127.0.0.1:8788}"
case "$BASE" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "❌ smoke.sh 只打本機(用的是 seed 帳密),BASE_URL=$BASE 被拒"; exit 2 ;;
esac

FAIL=0
pass() { echo "✅ $1"; }
fail() { echo "🔴 $1"; FAIL=1; }
# 參數一定要剛好三個:2026-09-27 第一版被 brace expansion 拆成多個參數,錯位比對印出「✅ 註冊 = 400」—— 假綠燈
eq()   { [ $# -eq 3 ] || { fail "eq 收到 $# 個參數(應為 3):$*"; return; }
         if [ "$2" = "$3" ]; then pass "$1 = $3"; else fail "$1:期望 $3,實際 $2"; fi; }
post() { curl -s "$BASE$1" -H "authorization: Bearer $2" -H 'content-type: application/json' -d "$3"; }
code() {   # $1 method $2 path $3 token [$4 body]
  if [ -n "$4" ]; then
    curl -s -o /dev/null -w '%{http_code}' -X "$1" "$BASE$2" -H "authorization: Bearer $3" -H 'content-type: application/json' -d "$4"
  else
    curl -s -o /dev/null -w '%{http_code}' -X "$1" "$BASE$2" -H "authorization: Bearer $3"
  fi
}

echo "smoke against $BASE"
curl -sf "$BASE/health" > /dev/null || { echo "❌ $BASE/health 打不通 —— 先 npm run dev"; exit 2; }

EMAIL="smoke-$(date +%s)@example.com"
# JSON 先放進變數再傳:macOS 的 sh 是 bash,"$( … "{…,…}" … )" 裡的大括號會被當成 brace expansion 拆開
REG=$(printf '{"email":"%s","password":"password1","nickname":"smoke"}' "$EMAIL")
LOGIN=$(printf '{"email":"%s","password":"password1"}' "$EMAIL")
eq "註冊" "$(code POST /auth/register '' "$REG")" 201
TOK=$(post /auth/login '' '{"email":"staff@example.com","password":"password123"}' | jq -r .access_token)
MEM=$(post /auth/login '' "$LOGIN" | jq -r .access_token)
[ "$TOK" != null ] && [ -n "$TOK" ] || { echo "❌ staff 登入失敗 —— 先 npm run db:seed"; exit 2; }

EV=$(post /events "$TOK" '{"name":"smoke","opens_at":0,"deadline_at":4102444800000}' | jq -r .id)
TT=$(post "/events/$EV/ticket-types" "$TOK" '{"name":"一般","price_cents":100000,"capacity":60,"early_bird_pct":10,"early_bird_until":4102444800000}' | jq -r .id)

HOLD4=$(printf '{"ticket_type_id":"%s","seat_nos":["A1","A2","A3","A4"]}' "$TT")
HOLD1=$(printf '{"ticket_type_id":"%s","seat_nos":["A1"]}' "$TT")
H=$(post "/events/$EV/holds" "$MEM" "$HOLD4" | jq -r .id)
O=$(post "/holds/$H/confirm" "$MEM" '{"promo_code":"WELCOME"}')
OID=$(echo "$O" | jq -r .id)
eq "subtotal_cents" "$(echo "$O" | jq -r .subtotal_cents)" 400000
eq "early_bird_pct" "$(echo "$O" | jq -r .early_bird_pct)" 10
eq "group_pct(擇優不疊加)" "$(echo "$O" | jq -r .group_pct)" 0
eq "promo_code(WELCOME 沒被選中)" "$(echo "$O" | jq -r .promo_code)" null
eq "total_cents" "$(echo "$O" | jq -r .total_cents)" 360000

eq "改價" "$(code PATCH "/ticket-types/$TT" "$TOK" '{"price_cents":1}')" 200
eq "改價後重讀 total_cents(規則 V)" "$(curl -s "$BASE/orders/$OID" -H "authorization: Bearer $MEM" | jq -r .total_cents)" 360000
eq "非主辦 PATCH /events" "$(code PATCH "/events/$EV" "$MEM" '{"name":"x"}')" 403

eq "取消訂單" "$(curl -s -X POST "$BASE/orders/$OID/cancel" -H "authorization: Bearer $MEM" | jq -r .status)" cancelled
eq "取消後重 hold A1(C11)" "$(code POST "/events/$EV/holds" "$MEM" "$HOLD1")" 201

[ "$FAIL" = 0 ] && echo "✅ smoke 全過" || { echo "🔴 smoke 有失敗"; exit 1; }
