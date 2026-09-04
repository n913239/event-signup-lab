#!/bin/sh
# 對「已部署」的環境打 N 個併發報名,驗不超賣。
#
# ⚠️ 這支跟 npm run test:race 不是同一件事:
#    test:race  = 單一 process 內用閘門重現競態(現在就跑得了)
#    race.sh    = 真的多連線打遠端 Worker(要等部署之後)
#    verified.md 必須把兩者分開記 —— v3 就是因為混為一談,
#    四篇文章都寫「壓測腳本當裁判」,而那支腳本根本不存在。
set -e
N="${1:-50}"
BASE="${BASE_URL:-http://127.0.0.1:8788}"
EVENT_ID="${EVENT_ID:?請設 EVENT_ID}"
TOKEN="${TOKEN:?請設 TOKEN}"

echo "打 $N 個併發到 $BASE/events/$EVENT_ID/holds"

before=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/events/$EVENT_ID" | grep -o '"remaining":[0-9]*' | head -1)
echo "before: $before"

i=0
while [ "$i" -lt "$N" ]; do
  curl -s -o /dev/null -w '%{http_code}\n' \
    -X POST "$BASE/events/$EVENT_ID/holds" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"seat_no\":\"A$i\"}" &
  i=$((i + 1))
done
wait

after=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/events/$EVENT_ID" | grep -o '"remaining":[0-9]*' | head -1)
echo "after:  $after"
echo ""
echo "手動核對:remaining 不得為負;成功筆數 + remaining 必須等於原始名額"
