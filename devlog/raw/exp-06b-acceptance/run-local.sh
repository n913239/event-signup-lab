#!/bin/bash
# 你手動跑(proxy 要先開著):B、C 各兩次,交錯跑。約 100 分鐘以上
cd "$(dirname "$0")"; R=$PWD
lms load qwen3.6-35b-a3b-mlx -c 65536 --gpu max -y >/dev/null 2>&1; lms ps | grep -q qwen3.6 || { echo "模型沒載入"; exit 1; }
for id in b1 c1 b2 c2; do
  mkdir -p out/$id; echo "▶ $id $(date +%T)"
  docker run --rm -v "$R/out/$id:/work" -v "$R:/cfg:ro" ww-rerun bash /cfg/in-container.sh ${id:0:1}
done
echo "全部跑完 $(date +%T)"
