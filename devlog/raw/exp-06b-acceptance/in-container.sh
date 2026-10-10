#!/bin/bash
# 容器內:重灌資料庫 → 起 wrangler dev + vite → 跑 agent → 存資料庫最後狀態
MODE=$1; MODEL=${MODEL:-qwen3.6-35b-a3b-mlx}; MODEL_YAML=${MODEL_YAML:-/cfg/model_lmstudio.yaml}; L=$G/tmp/es-web-lab; W=/work; cd $L
rm -rf .wrangler
npx wrangler d1 execute signup --local --file=./schema.sql >/dev/null 2>&1
npx wrangler d1 execute signup --local --file=./seed.sql >/dev/null 2>&1
npm run dev > $W/wrangler.log 2>&1 &
(cd web && npx vite --port 5173 --strictPort --host 127.0.0.1 > $W/vite.log 2>&1 &)
for i in $(seq 60); do curl -sf localhost:8788/health >/dev/null && curl -sf localhost:5173 >/dev/null && break; sleep 2; done
curl -sf localhost:8788/health >/dev/null || { echo "dev server 沒起來"; exit 1; }
curl -s -o /dev/null -w "proxy→LM Studio: %{http_code}\n" http://host.docker.internal:1235/v1/models | tee $W/proxy-check.txt
start=$(date +%s); cd $W
if [ "$MODE" = c ]; then
  export PATH="$G/webwright-lab/.venv/bin:$PATH" OPENAI_API_KEY=via-proxy
  timeout ${LIMIT:-90m} python -m webwright.run.cli main -c base.yaml -c $MODEL_YAML \
    -t "$(cat /cfg/task-c.txt)" --start-url http://localhost:5173 --task-id member_ticket -o outputs > run.log 2>&1
else
  timeout ${LIMIT:-90m} pi -p --model $MODEL -t read,write,edit,grep,find,ls,bash --no-session "$(cat /cfg/task-b.md)" < /dev/null > pi.log 2>&1
fi
echo "model=$MODEL limit=${LIMIT:-90m} exit=$? 秒數=$(( $(date +%s) - start ))" | tee $W/exit.txt
DB=$(ls $L/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite | head -1)
sqlite3 -header $DB "select seat_no,ticket_type_id,status from seat_holds order by created_at; select o.status,o.total_cents,i.seat_no,i.unit_price_cents from orders o join order_items i on i.order_id=o.id;" > $W/db-final.txt
