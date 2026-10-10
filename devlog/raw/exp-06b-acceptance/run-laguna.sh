#!/bin/bash
# 你手動跑(proxy 要開著):Laguna XS 2.1 的 B、C 各兩次,交錯跑。時限 90 分鐘(跟 qwen3.6 一樣)。
cd "$(dirname "$0")"; R=$PWD
lms ps | grep -q laguna || { lms unload --all >/dev/null 2>&1; lms load laguna-xs-2.1 -c 65536 --gpu max -y >/dev/null 2>&1; }
lms ps | grep -q laguna || { echo "模型沒載入"; exit 1; }
for id in bL-1 cL-1 bL-2 cL-2; do
  mkdir -p out/$id; echo "▶ $id $(date +%T)"
  caffeinate -is docker run --rm -v "$R/out/$id:/work" -v "$R:/cfg:ro" -v "$R/models-laguna.json:/root/.pi/agent/models.json:ro" \
    -e MODEL=laguna-xs-2.1 -e MODEL_YAML=/cfg/model_lmstudio-laguna.yaml -e LIMIT=90m ww-rerun bash /cfg/in-container.sh ${id:0:1}
done
echo "全部跑完 $(date +%T)"
