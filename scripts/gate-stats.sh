#!/bin/sh
# Day 30 的帳本 —— 這 30 天閘門跑了幾次、擋下幾次。
#
# CI 每一輪會把自己的結果寫進 job summary(見 ci.yml 最後一步),
# 這支從 GitHub API 把它們加總起來。需要 gh 已登入。
#
# 用法: sh scripts/gate-stats.sh [起始日 YYYY-MM-DD]
set -e
SINCE="${1:-2026-09-10}"
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

echo "=== $REPO · $SINCE 起 ==="
gh run list --limit 500 --json conclusion,createdAt,headSha,displayTitle \
  --jq "[.[] | select(.createdAt >= \"${SINCE}\")]" > /tmp/gate-runs.json

TOTAL=$(jq 'length' /tmp/gate-runs.json)
GREEN=$(jq '[.[] | select(.conclusion=="success")] | length' /tmp/gate-runs.json)
RED=$(jq   '[.[] | select(.conclusion=="failure")] | length' /tmp/gate-runs.json)

printf "%-24s %s\n" "CI 總跑次數"  "$TOTAL"
printf "%-24s %s\n" "  綠"        "$GREEN"
printf "%-24s %s\n" "  紅(擋下)" "$RED"
echo
echo "紅燈明細(哪一次擋下什麼):"
jq -r '.[] | select(.conclusion=="failure")
       | "  \(.createdAt[:10])  \(.headSha[:12])  \(.displayTitle)"' /tmp/gate-runs.json
echo
echo "commit 數: $(git rev-list --count --since="$SINCE" HEAD)"
echo
echo "註:哪一支靜態檢查擋下的,看該次 run 的 job summary"
echo "    gh run view <id> 或 https://github.com/$REPO/actions"
