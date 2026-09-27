#!/bin/sh
# 對「已部署」的環境真的開多連線打,驗不超賣、座位不重複(T053;SC-001 / SC-002 的遠端版)。
#
# ⚠️ 這支跟 npm run test:race 不是同一件事:
#    test:race  = 單一 process 內用閘門重現競態
#    race.sh    = 真的多連線打遠端 Worker
#    verified.md 必須把兩者分開記 —— v3 就是因為混為一談,
#    四篇文章都寫「壓測腳本當裁判」,而那支腳本根本不存在。
#
# 用法:BASE_URL=https://… STAFF_TOKEN=<主辦的 access token> sh scripts/race.sh [輪數]
#   每輪建兩個測試活動(名稱 race-<時間>-…),跑完就截止(close),不留在開賣列表裡:
#   A. 20 個成員同時搶同一個座位 A1         → 期望恰 1 個 201、19 個 409
#   B. 20 個成員同時搶名額 5 的票種、各不同座 → 期望恰 5 個 201、15 個 409,remaining = 0
#   成員帳號第一次跑時註冊(race-m<i>@example.com),密碼隨機、只存在暫存目錄。
set -e
ROUNDS="${1:-5}"
N=20
BASE="${BASE_URL:?請設 BASE_URL}"
STAFF="${STAFF_TOKEN:?請設 STAFF_TOKEN(主辦的 access token)}"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
OUT="devlog/raw/race-$(date +%Y-%m-%d).txt"
RUN="$(date +%H%M%S)"

j() { curl -s "$BASE$1" -H "authorization: Bearer $2" -H 'content-type: application/json' ${3:+-d} ${3:+"$3"}; }

# 成員:每次跑都註冊新的一批(不重用密碼、不需要記住)
i=0
while [ "$i" -lt "$N" ]; do
  PW=$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')
  EMAIL="race-$RUN-m$i@example.com"
  BODY=$(printf '{"email":"%s","password":"%s","nickname":"race%s"}' "$EMAIL" "$PW" "$i")
  j /auth/register '' "$BODY" > /dev/null
  j /auth/login '' "$(printf '{"email":"%s","password":"%s"}' "$EMAIL" "$PW")" | jq -r .access_token > "$TMP/tok$i"
  i=$((i + 1))
done
grep -q null "$TMP"/tok* && { echo "❌ 有成員登入失敗"; exit 2; }

# 同時放 N 個 hold:每行「token 路徑 座位」,xargs -P N 一起起跑,回傳每個的 HTTP code + error
fire() {  # $1 event $2 ticket type $3 座位產生方式(same | distinct)
  : > "$TMP/jobs"
  k=0
  for r in A B C D E F G H I J; do for c in 1 2; do
    [ "$k" -ge "$N" ] && break
    if [ "$3" = same ]; then seat=A1; else seat="$r$c"; fi
    echo "$TMP/tok$k $seat" >> "$TMP/jobs"; k=$((k + 1))
  done; done
  xargs -P "$N" -L 1 sh -c 'curl -s -w " %{http_code}\n" -X POST "$0/events/$1/holds" -H "authorization: Bearer $(cat $3)" -H "content-type: application/json" -d "{\"ticket_type_id\":\"$2\",\"seat_nos\":[\"$4\"]}" | sed -E "s/.*\"error\":\"([a-z_]+)\".* ([0-9]+)$/\2 \1/; s/^\{.* ([0-9]+)$/\1/"' \
    "$BASE" "$1" "$2" < "$TMP/jobs" | sort | uniq -c | tr -s ' ' | tr '\n' ';'
}

newEvent() {  # $1 name $2 capacity → 印「event_id ticket_type_id」
  ev=$(j /events "$STAFF" "$(printf '{"name":"%s","opens_at":0,"deadline_at":4102444800000}' "$1")" | jq -r .id)
  tt=$(j "/events/$ev/ticket-types" "$STAFF" "$(printf '{"name":"race","price_cents":100,"capacity":%s}' "$2")" | jq -r .id)
  echo "$ev $tt"
}

FAIL=0
# 不用 { … } | tee:那樣迴圈跑在子 shell,FAIL 傳不出來,最後的判斷永遠綠
exec 3>&1
LOG="$TMP/log"
{
  echo "# race.sh $(date '+%Y-%m-%d %H:%M:%S %z') against $BASE,$ROUNDS 輪,每輪 $N 條連線同時起跑"
  r=1
  while [ "$r" -le "$ROUNDS" ]; do
    set -- $(newEvent "race-$RUN-r$r-seat" 20)
    A=$(fire "$1" "$2" same)
    j "/events/$1/close" "$STAFF" > /dev/null
    set -- $(newEvent "race-$RUN-r$r-quota" 5)
    B=$(fire "$1" "$2" distinct)
    rem=$(j "/events/$1" "$STAFF" | jq -r '.ticket_types[0].remaining')
    sold=$(j "/events/$1" "$STAFF" | jq '[.seats[] | select(.state != "free")] | length')
    j "/events/$1/close" "$STAFF" > /dev/null
    # 比完整的一段「 1 201;」,前面的空白不能省:只比 '1 201;' 的話「11 201;」也會中
    okA=$(echo "$A" | grep -oE '(^| )1 201;' | head -1); okB=$(echo "$B" | grep -oE '(^| )5 201;' | head -1)
    [ -n "$okA" ] && [ -n "$okB" ] && [ "$rem" = 0 ] && [ "$sold" = 5 ] && v=✅ || { v=🔴; FAIL=1; }
    echo "$v 第 $r 輪 | A 同座位:$A | B 名額 5:$B remaining=$rem 佔位座位=$sold"
    r=$((r + 1))
  done
  [ "$FAIL" = 0 ] && echo "✅ $ROUNDS 輪全部一致:同座位恰 1 人、名額 5 恰 5 人,remaining 不為負" || echo "🔴 有輪次不符"
} > "$LOG"
cat "$LOG" >&3; cat "$LOG" >> "$OUT"
grep -q '^🔴' "$LOG" && exit 1
exit 0
