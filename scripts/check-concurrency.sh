#!/bin/sh
# 併發判斷必須寫在 SQL 的 WHERE 裡,而且必須檢查 changes。
#
# 兩道,都是必要條件而非充分條件:
#   A. 每一個 UPDATE 語句都要有 WHERE(整張表無條件改 = 一定沒有守門)
#   B. 出現 UPDATE 的檔案必須提到 changes(條件寫進去了卻不看結果,
#      等於 0 列被改也當成功 —— 這是 D1 上最常見的假成功)
#
# ⚠️ 抓不到的:WHERE 存在但條件不足(例如只有 WHERE id = ? 而沒有
#   AND remaining > 0)。那需要知道哪一欄是被搶的資源,grep 判斷不了。
#   B 在實務上會連帶抓到它,因為先查再寫的寫法通常也不檢查 changes。
set -e
. "$(dirname "$0")/_lib.sh"
cd "$(dirname "$0")/.."
[ -d src ] || { echo "跳過: 併發 (src/ 還不存在)"; exit 0; }

FILES=$(find src -type f \( -name '*.js' -o -name '*.ts' -o -name '*.sql' \) \
        ! -name '*.test.*' ! -name '*.spec.*' 2>/dev/null)
[ -n "$FILES" ] || { echo "✅ 併發:src/ 還沒有可掃的檔案"; exit 0; }

RC=0
for f in $FILES; do
  # 先剝註解:一句 // update remaining 會讓下面兩道都誤報,
  # 而一句 // r.meta.changes 又會餵飽第二道(2026-09-10 兩個方向都實測過)
  SRC=$(strip_comments "$f")

  # 把換行拉平,然後在每個 UPDATE 前斷行 —— 一行一個 UPDATE 語句,
  # 單引號、雙引號 SQL 與多行 template literal 都能一致處理。
  # 只認全大寫 UPDATE 且後面接得到 SET,英文散文就不會中。
  BAD=$(printf '%s' "$SRC" | tr '\n' ' ' |
        sed 's/UPDATE[[:space:]]/\
&/g' |
        awk '$0 ~ /^UPDATE[[:space:]]+[A-Za-z_"\[]/ && toupper($0) ~ /SET/ && toupper($0) !~ /WHERE/ {
               print substr($0, 1, 120) }')
  if [ -n "$BAD" ]; then
    echo "❌ $f:UPDATE 沒有 WHERE"
    echo "$BAD" | sed 's/^/   /'
    RC=1
  fi

  # 有 UPDATE 就必須看得到 changes。接受 r.meta.changes 與解構寫法
  # const { changes } = r.meta —— 後者是合法且常見的,第一版把它擋掉了。
  # 要看得到 SET 才算 UPDATE 語句 —— 否則錯誤訊息字串
  # 'UPDATE failed for ' 這種也會中(2026-09-10 實測)
  if printf '%s' "$SRC" | tr '\n' ' ' | sed 's/UPDATE[[:space:]]/\
&/g' | grep -qE '^UPDATE[[:space:]]+[A-Za-z_"[].*[Ss][Ee][Tt]' &&
     ! printf '%s' "$SRC" | grep -qE '\.changes[^A-Za-z_]|\{[^}]*\bchanges\b[^}]*\}[[:space:]]*='; then
    echo "❌ $f:有 UPDATE 卻沒有檢查 changes"
    echo "   條件式寫入要看 res.meta.changes,0 列被改代表沒搶到"
    RC=1
  fi
done

[ "$RC" -eq 0 ] && echo "✅ UPDATE 都有 WHERE,且都檢查了 changes"
exit $RC
