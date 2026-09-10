#!/bin/sh
# schema 裁判的自我測試:每一條斷言都要證明它會紅。
# 對照表見 tests/fixtures/schema/README.md
set -e
cd "$(dirname "$0")/.."
FAIL=0
echo "=== schema 裁判自我測試 ==="
for f in tests/fixtures/schema/bad-*.sql; do
  n=$(basename "$f" .sql)
  if SCHEMA="$f" npx vitest run tests/schema.test.js >/dev/null 2>&1; then
    echo "🔴 $n — 沒抓到(裁判壞了)"; FAIL=1
  else
    echo "✅ $n — 抓得到"
  fi
done
printf '%s' "--- 正確的 schema 不得誤報 --- "
if SCHEMA=tests/fixtures/schema/good.sql npx vitest run tests/schema.test.js >/dev/null 2>&1; then
  echo "✅ good — 沒誤報"
else
  echo "🔴 good — 誤報了(正確的 schema 被判紅)"; FAIL=1
fi
exit $FAIL
