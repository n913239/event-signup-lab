#!/bin/bash
# 你手動跑:A(Claude + Webwright plugin + 驗收條件,不掛 MCP)兩次,主機上跑,跟 9/28 一樣
cd "$(dirname "$0")"; R=$PWD; G=<github>; L=$G/tmp/es-web-lab
for id in a1 a2; do
  (cd $L && rm -rf .wrangler && npx wrangler d1 execute signup --local --file=./schema.sql >/dev/null 2>&1 && npx wrangler d1 execute signup --local --file=./seed.sql >/dev/null 2>&1)
  (cd $L && npm run dev > $R/out/$id-wrangler.log 2>&1 &) ; (cd $L/web && npx vite --port 5173 --strictPort > $R/out/$id-vite.log 2>&1 &)
  for i in $(seq 60); do curl -sf localhost:8788/health >/dev/null && curl -sf localhost:5173 >/dev/null && break; sleep 2; done
  mkdir -p out/$id && cd out/$id; echo "▶ $id $(date +%T)"
  claude -p --plugin-dir $G/webwright-lab --output-format json \
    --allowedTools "Bash,Read,Write,Edit,Glob,Grep,Skill" < $R/prompt-a.md > result.json 2> stderr.log
  echo "exit=$?" > exit.txt
  sqlite3 -header $(ls $L/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite | head -1) \
    "select seat_no,ticket_type_id,status from seat_holds order by created_at; select o.status,o.total_cents,i.seat_no,i.unit_price_cents from orders o join order_items i on i.order_id=o.id;" > db-final.txt
  cd $R; pkill -f 'wrangler dev' ; pkill -f 'vite --port 5173'; sleep 2
done
echo "A 跑完 $(date +%T)"
