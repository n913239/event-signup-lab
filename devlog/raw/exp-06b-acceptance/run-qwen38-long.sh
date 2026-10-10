#!/bin/bash
# 你手動跑:qwen3.8 放寬時限的完整版(B 一次、C 一次,各最多 4 小時,最長約 8 小時)。
# 自己開 proxy、自己收:跑完會關 proxy、卸載模型。中途 Ctrl-C 也會收尾。
cd "$(dirname "$0")"; R=$PWD
cleanup() {
  docker stop $(docker ps -q --filter ancestor=ww-rerun) >/dev/null 2>&1
  [ -n "$PROXY" ] && kill $PROXY 2>/dev/null
  lms unload --all >/dev/null 2>&1
  echo "收尾完成 $(date +%T)"
}
trap 'cleanup; exit 130' INT TERM

# proxy:沒在跑才開(key 照舊由 start-proxy.sh 讀,不會印出來)
if ! lsof -iTCP:1235 -sTCP:LISTEN >/dev/null 2>&1; then
  ./start-proxy.sh & PROXY=$!; sleep 2
fi
lsof -iTCP:1235 -sTCP:LISTEN >/dev/null 2>&1 || { echo "proxy 沒起來"; exit 1; }

lms unload --all >/dev/null 2>&1
lms load qwen3.8-27b-mlx -c 65536 --gpu max -y >/dev/null 2>&1
lms ps | grep -q qwen3.8 || { echo "模型沒載入"; cleanup; exit 1; }

for id in b38-L2 c38-L2; do
  mkdir -p out/$id; echo "▶ $id $(date +%T)"
  caffeinate -is docker run --rm -v "$R/out/$id:/work" -v "$R:/cfg:ro" -v "$R/models-38.json:/root/.pi/agent/models.json:ro" \
    -e MODEL=qwen3.8-27b-mlx -e MODEL_YAML=/cfg/model_lmstudio-38.yaml -e LIMIT=240m ww-rerun bash /cfg/in-container.sh ${id:0:1}
  echo "  $(cat out/$id/exit.txt 2>/dev/null)"
done
cleanup
