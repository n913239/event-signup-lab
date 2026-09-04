#!/bin/sh
# 金額路徑不得出現浮點運算。
# Day 25 的教訓:顯示轉換(分→元,要 /100)一律放 src/presentation/,本腳本不掃那裡。
set -e
. "$(dirname "$0")/_lib.sh"

FLOAT='parseFloat|toFixed\(|\* *1\.0|\bfloat\b|\bREAL\b'
DIV='/ *100([^0-9]|$)'

if ! scan "金額浮點" "$FLOAT" src/domain src/routes; then
  echo ""; echo "❌ 金額路徑出現浮點運算 —— 一律用整數(最小單位)"; exit 1
fi
if ! scan "金額除法" "$DIV" src/domain src/routes; then
  echo ""; echo "❌ 金額路徑出現 /100 —— 那是顯示轉換,應放 src/presentation/"; exit 1
fi
echo "✅ 金額路徑零浮點"
