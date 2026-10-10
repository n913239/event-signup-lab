#!/bin/bash
# 你手動跑(proxy 要開著):qwen3.8-27b 版的 B、C。先跑 B 兩次,再跑 C 兩次;中途可以 Ctrl-C
cd "$(dirname "$0")"; R=$PWD
lms unload --all >/dev/null 2>&1
lms load qwen3.8-27b-mlx -c 65536 --gpu max -y >/dev/null 2>&1; lms ps | grep -q qwen3.8 || { echo "模型沒載入"; exit 1; }
for id in b38-1 b38-2 c38-1 c38-2; do
  mkdir -p out/$id; echo "▶ $id $(date +%T)"
  docker run --rm -v "$R/out/$id:/work" -v "$R:/cfg:ro" -v "$R/models-38.json:/root/.pi/agent/models.json:ro" \
    -e MODEL=qwen3.8-27b-mlx -e MODEL_YAML=/cfg/model_lmstudio-38.yaml ww-rerun bash /cfg/in-container.sh ${id:0:1}
done
echo "全部跑完 $(date +%T)"
