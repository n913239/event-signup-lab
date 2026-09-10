#!/bin/sh
# 硬規則 5 的一半:確認後的訂單金額不可變。
#
# 可執行的形式:**沒有任何 UPDATE 可以寫入金額欄。**
# 金額只在建單的那一次 INSERT 寫進去(那就是「快照」),之後任何改動都是違反。
# 金額欄靠規則 1 的命名約定辨識(欄名帶單位,例如 _cents)。
#
# ⚠️ 這支**只管得到「不可變」那一半**。
#   規則 5 的另一半是「明細要存快照,不是靠 ticket_type_id JOIN 即時算」——
#   那要知道票種表與價格欄叫什麼,而 docs/spec.md 目前只定義 17 條 endpoint,
#   沒定義 schema。schema.sql 落地之後補,在那之前那一半只有 /check-schema 第 6 條
#   在人工把關(見 docs/verified.md)。
set -e
. "$(dirname "$0")/_lib.sh"
cd "$(dirname "$0")/.."
[ -d src ] || { echo "跳過: 價格快照 (src/ 還不存在)"; exit 0; }

FILES=$(find src -type f \( -name '*.js' -o -name '*.ts' -o -name '*.sql' \) \
        ! -name '*.test.*' ! -name '*.spec.*' 2>/dev/null)
[ -n "$FILES" ] || { echo "✅ 價格快照:src/ 還沒有可掃的檔案"; exit 0; }

# 金額欄:帶單位的欄名(規則 1 的約定),或直白的 amount/price/total
# 金額欄:規則 1 要求欄名帶單位,所以只認 _cents / _amount 結尾,
# 並加詞界 —— 第一版用 (price|total|amount) 無錨,連 price_locked、
# total_seats 這種合法欄名都中(2026-09-10 實測)。
MONEY='[a-z_]*(_cents|_amount)([^a-z_]|$)'
# 只管訂單側的表。票種的現價本來就該能改(`PATCH /ticket-types/:id`,
# docs/spec.md 第 11 條),不能改的是**已成立訂單的快照**。
# 表名出處:.claude/commands/check-schema.md 第 6 條。
ORDER_TABLES='orders|order_items'

RC=0
for f in $FILES; do
  SRC=$(strip_comments "$f")
  FLAT=$(printf '%s' "$SRC" | tr '\n' ' ')

  # (一) UPDATE <訂單表> SET … <金額欄> =
  #     表名前可能有 OR IGNORE/REPLACE(正規 SQLite 語法)、schema 前綴、
  #     引號或方括號 —— 第一版全部漏掉。
  BAD=$(printf '%s' "$FLAT" | sed 's/UPDATE[[:space:]]/\
&/g' |
        awk -v m="$MONEY" -v ot="$ORDER_TABLES" '
          toupper($0) ~ /^UPDATE[[:space:]]/ && toupper($0) ~ /SET/ {
            t = $0
            sub(/^[Uu][Pp][Dd][Aa][Tt][Ee][[:space:]]+/, "", t)
            sub(/^[Oo][Rr][[:space:]]+[A-Za-z]+[[:space:]]+/, "", t)   # OR IGNORE / OR REPLACE
            gsub(/["\[\]`]/, "", t)                                    # "orders" [orders] `orders`
            sub(/[^A-Za-z_.].*/, "", t)
            sub(/^[A-Za-z_]+\./, "", t)                                # main.orders → orders
            if (tolower(t) !~ "^(" ot ")$") next
            v = $0
            sub(/^[^Ss]*[Ss][Ee][Tt][[:space:]]/, "", v)
            sub(/[Ww][Hh][Ee][Rr][Ee][[:space:]].*/, "", v)
            if (tolower(v) ~ m "[[:space:]]*=") print substr($0, 1, 120)
          }')

  # (二) UPSERT 與 REPLACE INTO —— 改寫已成立訂單金額的另外兩條通道
  # ⚠️ 這裡不要用 ["\[]? 這種選擇性引號字元類 —— 互動 shell 的 ugrep 吃,
  #    但 hook 與 CI 跑在 sh 底下用 BSD grep,它不吃,而且是靜默不吃。
  #    2026-09-10 手測通過、腳本裡卻抓不到,查了才發現是兩個 grep。
  #    LEDGER 第 1 筆同一種病的第七次。改成先剝引號再比。
  NOQ=$(printf '%s' "$FLAT" | tr -d '"`[]')
  BAD2=$(printf '%s' "$NOQ" |
         grep -oiE '(REPLACE|INSERT[[:space:]]+OR[[:space:]]+REPLACE)[[:space:]]+INTO[[:space:]]+('"$ORDER_TABLES"')([^A-Za-z_]|$)[^;]*' || true)
  BAD3=$(printf '%s' "$FLAT" |
         grep -oiE 'DO[[:space:]]+UPDATE[[:space:]]+SET[^;)]*(_cents|_amount)[[:space:]]*=' || true)

  if [ -n "$BAD$BAD2$BAD3" ]; then
    echo "❌ $f:改寫了訂單的金額欄"
    [ -n "$BAD"  ] && echo "$BAD"  | sed 's/^/   UPDATE  /'
    [ -n "$BAD2" ] && echo "$BAD2" | sed 's/^/   REPLACE /'
    [ -n "$BAD3" ] && echo "$BAD3" | sed 's/^/   UPSERT  /'
    echo "   確認後金額不可變 —— 金額只在建單那次 INSERT 寫入"
    RC=1
  fi
done

[ "$RC" -eq 0 ] && echo "✅ 沒有任何寫法改到訂單的金額欄"
exit $RC
