# 共用:掃描並在命中時失敗。
#
# 🔴 血的教訓(2026-09-04):第一版用 rg,而 rg 在 sh 底下是不存在的
# (它是互動 shell 的 function),再加上 2>/dev/null 把錯誤吃掉,
# 結果三支檢查全部「因為工具不存在而通過」—— 綠燈,而且完全沒有徵兆。
# 現在一律用 POSIX grep,而且任何非預期的 exit code 都要炸出來。

# 把註解剝掉再交給檢查。
# 2026-09-10:註解在兩個方向上都咬人 —— 一句「// update remaining count」
# 讓併發檢查誤報,一句「// r.meta.changes tells you…」又餵飽了它。
# 尺不該讀人話,只該讀 code。
strip_comments() {
  # // 到行尾,但放過 URL 的 :// —— 2026-09-10 第一版寫成
  # 's://[^"'"'"'`]*$::',結果註解裡只要有一個撇號(don't)字元類就斷掉,
  # 整行沒被剝掉。自己的剝註解器也是一把要驗的尺。
  sed -E 's@([^:])//.*$@\1@; s@^//.*$@@' "$1" | sed -E 's:/\*([^*]|\*[^/])*\*/::g'
}

scan() {
  _label="$1"; _pattern="$2"; shift 2
  _dirs=""
  for d in "$@"; do [ -d "$d" ] && _dirs="$_dirs $d"; done
  if [ -z "$_dirs" ]; then
    echo "跳過: $_label (目標目錄還不存在)"
    return 0
  fi

  # SCAN_EXCLUDE:要跳過的子目錄名。SCAN_ICASE=1:不分大小寫。
  # 2026-09-10 兩件事:
  #   (1) 掃描範圍從 src/domain src/routes 放大到整個 src —— 原本放在
  #       src/lib/ 或 src/auth/ 的程式碼三支檢查全部看不到,而 impl-spec
  #       的陷阱 7 寫的路徑就是 src/auth/。尺是好的,只是沒伸到那裡。
  #   (2) 逐檔剝掉註解再比 —— 註解兩個方向都咬人:一句英文註解會誤報,
  #       一句提到目標字串的註解又會餵飽檢查。尺不該讀人話,只該讀 code。
  set +e
  _out=""
  _rc=1
  _files=$(find $_dirs -type f \( -name '*.js' -o -name '*.mjs' -o -name '*.cjs' \
             -o -name '*.ts' -o -name '*.mts' -o -name '*.tsx' -o -name '*.sql' \) \
           ! -name '*.test.*' ! -name '*.spec.*' 2>/dev/null)
  for _f in $_files; do
    case "$_f" in
      */__tests__/*) continue ;;
    esac
    if [ -n "${SCAN_EXCLUDE:-}" ]; then
      case "$_f" in */"$SCAN_EXCLUDE"/*) continue ;; esac
    fi
    if [ "${SCAN_ICASE:-}" = "1" ]; then
      _hit=$(strip_comments "$_f" | grep -inE "$_pattern" 2>&1)
    else
      _hit=$(strip_comments "$_f" | grep -nE "$_pattern" 2>&1)
    fi
    _hrc=$?
    if [ "$_hrc" -gt 1 ]; then
      echo "💥 檢查本身壞了(grep exit $_hrc):$_hit"; exit 2
    fi
    if [ "$_hrc" -eq 0 ]; then
      _out="$_out$(printf '%s' "$_hit" | sed "s|^|$_f:|")
"
      _rc=0
    fi
  done
  set -e

  # 0=有命中 1=沒命中
  if [ "$_rc" -eq 0 ]; then
    echo "$_out"
    return 1
  fi
  return 0
}
