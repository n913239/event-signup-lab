#!/bin/bash
# 你手動跑(proxy 要開著):qwen3.8 放寬時限的過夜版。B 一次、C 一次,各最多 4 小時。
# caffeinate 讓 Mac 在跑完之前不會睡著
cd "$(dirname "$0")"; R=$PWD
[ -d out/b38-2 ] && mv out/b38-2 out/b38-2-aborted
lms ps | grep -q qwen3.8 || lms load qwen3.8-27b-mlx -c 65536 --gpu max -y >/dev/null 2>&1
lms ps | grep -q qwen3.8 || { echo "模型沒載入"; exit 1; }
for id in b38-L1 c38-L1; do
  mkdir -p out/$id; echo "▶ $id $(date +%T)"
  caffeinate -is docker run --rm -v "$R/out/$id:/work" -v "$R:/cfg:ro" -v "$R/models-38.json:/root/.pi/agent/models.json:ro" \
    -e MODEL=qwen3.8-27b-mlx -e MODEL_YAML=/cfg/model_lmstudio-38.yaml -e LIMIT=240m ww-rerun bash /cfg/in-container.sh ${id:0:1}
done
echo "全部跑完 $(date +%T)"
