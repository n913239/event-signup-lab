# 共用:掃描並在命中時失敗。
#
# 🔴 血的教訓(2026-09-04):第一版用 rg,而 rg 在 sh 底下是不存在的
# (它是互動 shell 的 function),再加上 2>/dev/null 把錯誤吃掉,
# 結果三支檢查全部「因為工具不存在而通過」—— 綠燈,而且完全沒有徵兆。
# 現在一律用 POSIX grep,而且任何非預期的 exit code 都要炸出來。

scan() {
  _label="$1"; _pattern="$2"; shift 2
  _dirs=""
  for d in "$@"; do [ -d "$d" ] && _dirs="$_dirs $d"; done
  if [ -z "$_dirs" ]; then
    echo "跳過: $_label (目標目錄還不存在)"
    return 0
  fi

  set +e
  _out=$(grep -rEn --include='*.js' --include='*.ts' --include='*.sql' \
                   --exclude='*.test.*' --exclude='*.spec.*' \
                   "$_pattern" $_dirs 2>&1)
  _rc=$?
  set -e

  # grep: 0=有命中 1=沒命中 >1=真的出錯
  if [ "$_rc" -gt 1 ]; then
    echo "💥 檢查本身壞了(grep exit $_rc):$_out"
    exit 2
  fi
  if [ "$_rc" -eq 0 ]; then
    echo "$_out"
    return 1
  fi
  return 0
}
