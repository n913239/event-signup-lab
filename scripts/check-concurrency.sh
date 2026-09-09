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
cd "$(dirname "$0")/.."
[ -d src ] || { echo "跳過: 併發 (src/ 還不存在)"; exit 0; }

FILES=$(find src -type f \( -name '*.js' -o -name '*.ts' -o -name '*.sql' \) \
        ! -name '*.test.*' ! -name '*.spec.*' 2>/dev/null)
[ -n "$FILES" ] || { echo "✅ 併發:src/ 還沒有可掃的檔案"; exit 0; }

RC=0
for f in $FILES; do
  # SQL 藏在字串裡:把換行拉平,再以反引號/單引號切開,逐段檢查
  BAD=$(tr '\n' ' ' < "$f" | tr '`' '\n' | tr "'" '\n' |
        awk 'toupper($0) ~ /UPDATE[ \t]+[A-Za-z_]/ && toupper($0) !~ /WHERE/ { print }')
  if [ -n "$BAD" ]; then
    echo "❌ $f:UPDATE 沒有 WHERE"
    echo "$BAD" | sed 's/^/   /'
    RC=1
  fi
  if grep -qiE 'UPDATE[[:space:]]+[A-Za-z_]' "$f" && ! grep -qE '\.changes[^A-Za-z_]' "$f"; then
    echo "❌ $f:有 UPDATE 卻沒有檢查 changes"
    echo "   條件式寫入要看 res.meta.changes,0 列被改代表沒搶到"
    RC=1
  fi
done

[ "$RC" -eq 0 ] && echo "✅ UPDATE 都有 WHERE,且都檢查了 changes"
exit $RC
