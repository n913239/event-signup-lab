#!/bin/bash
# 補跑:期望值寫進任務,qwen3.6 + Pi 兩次(bE36-3、bE36-4),每次最多 90 分鐘。
# 自己開 proxy、自己收尾(關 proxy、卸載模型);中途 Ctrl-C 也會收尾。約 1–2 小時。
cd "$(dirname "$0")"; R=$PWD
cleanup() {
  docker stop $(docker ps -q --filter ancestor=ww-rerun) >/dev/null 2>&1
  [ -n "$PROXY" ] && kill $PROXY 2>/dev/null
  lms unload --all >/dev/null 2>&1
  echo "收尾完成 $(date +%T)"
}
trap 'cleanup; exit 130' INT TERM
if ! lsof -iTCP:1235 -sTCP:LISTEN >/dev/null 2>&1; then ./start-proxy.sh & PROXY=$!; sleep 2; fi
lsof -iTCP:1235 -sTCP:LISTEN >/dev/null 2>&1 || { echo "proxy 沒起來"; exit 1; }

run() {  # $1=id $2=model $3=models.json(可空)
  mkdir -p out/$1; echo "▶ $1 $(date +%T)"
  local extra=(); [ -n "$3" ] && extra=(-v "$R/$3:/root/.pi/agent/models.json:ro")
  caffeinate -is docker run --rm -v "$R/out/$1:/work" -v "$R:/cfg:ro" "${extra[@]}" \
    -e MODEL=$2 -e LIMIT=90m -e TASK_B=/cfg/task-b-expect.md ww-rerun bash /cfg/in-container.sh b
  echo "  $(cat out/$1/exit.txt 2>/dev/null)"
}
load() { lms unload --all >/dev/null 2>&1; lms load $1 -c 65536 --gpu max -y >/dev/null 2>&1; lms ps | grep -q "$1" || { echo "$1 沒載入"; cleanup; exit 1; }; }

load qwen3.6-35b-a3b-mlx
run bE36-3 qwen3.6-35b-a3b-mlx
run bE36-4 qwen3.6-35b-a3b-mlx
cleanup
