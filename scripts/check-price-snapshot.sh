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
cd "$(dirname "$0")/.."
[ -d src ] || { echo "跳過: 價格快照 (src/ 還不存在)"; exit 0; }

FILES=$(find src -type f \( -name '*.js' -o -name '*.ts' -o -name '*.sql' \) \
        ! -name '*.test.*' ! -name '*.spec.*' 2>/dev/null)
[ -n "$FILES" ] || { echo "✅ 價格快照:src/ 還沒有可掃的檔案"; exit 0; }

# 金額欄:帶單位的欄名(規則 1 的約定),或直白的 amount/price/total
MONEY='[a-z_]*(_cents|_amount|amount|price|total)[a-z_]*'
# 只管訂單側的表。票種的現價本來就該能改(`PATCH /ticket-types/:id`,
# docs/spec.md 第 11 條),不能改的是**已成立訂單的快照**。
# 2026-09-10:第一版禁「任何 UPDATE 寫入金額欄」,連合法的改價一起擋 ——
# 而那條 endpoint 正是價格快照陷阱的觸發器,擋掉它 Day 26 就沒東西可寫。
# 表名出處:.claude/commands/check-schema.md 第 6 條。
ORDER_TABLES='orders|order_items'
RC=0
for f in $FILES; do
  # 把換行拉平,然後在每個 UPDATE 前面斷行 —— 一行一個 UPDATE 語句,
  # 這樣單引號 SQL 與多行 template literal 都能一致處理
  # (前一版以單引號切段,結果 SET status = 'confirmed', amount_cents = 0
  #  在 'confirmed' 那裡被切斷,金額欄逃掉了)
  BAD=$(tr '\n' ' ' < "$f" |
        sed 's/[Uu][Pp][Dd][Aa][Tt][Ee][ \t]/\
&/g' |
        awk -v m="$MONEY" -v ot="$ORDER_TABLES" '
          toupper($0) ~ /^UPDATE[ \t]+[A-Za-z_]/ && toupper($0) ~ /SET/ {
            t = $0
            sub(/^[Uu][Pp][Dd][Aa][Tt][Ee][ \t]+/, "", t)
            sub(/[^A-Za-z_].*/, "", t)
            if (tolower(t) !~ "^(" ot ")$") next     # 不是訂單側的表就不管
            s = $0
            sub(/^[^Ss]*[Ss][Ee][Tt][ \t]/, "", s)   # 第一個 SET 之後
            sub(/[Ww][Hh][Ee][Rr][Ee][ \t].*/, "", s) # WHERE 之後不算
            if (tolower(s) ~ m "[ \t]*=") print substr($0, 1, 120)
          }')
  if [ -n "$BAD" ]; then
    echo "❌ $f:UPDATE 寫入了訂單的金額欄"
    echo "$BAD" | sed 's/^/   /'
    echo "   確認後金額不可變 —— 金額只在建單那次 INSERT 寫入"
    RC=1
  fi
done

[ "$RC" -eq 0 ] && echo "✅ 沒有 UPDATE 寫入訂單的金額欄"
exit $RC
