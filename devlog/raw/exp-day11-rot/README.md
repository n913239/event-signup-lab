# 實驗 day11-rot:腐爛的 slash command 會不會給你假綠燈

日期 2026-09-12 / 模型 claude-opus-5 / **沒有給 CLAUDE.md**(見下方無菌室設定)

## 假設(結論是它被推翻了)

Day 11 原本斷言:「指令會腐爛,而且比 code 更安靜 —— 它會繼續愉快地檢查一份
已經不存在的規格,然後回你 PASS。」

具體到這個 repo:`.claude/commands/check-schema.md` 的第 4 條在 `c24ccbb` 是

```
4. **座位有 `UNIQUE(event_id, seat_no)`**。
```

到 `d67c03d` 改成部分唯一索引,而且述詞必須含 `confirmed`。

**預測:拿舊版指令去打 `bad-index.sql`(述詞只寫 `'holding'`),它會判 ✅ 8/8。**

## 無菌室設定

每一組都是一個乾淨目錄,只放四個檔:

```
<dir>/schema.sql                        ← 受試 schema(fixture 改名而來)
<dir>/docs/spec.md
<dir>/docs/non-goals.md
<dir>/.claude/commands/check-schema.md  ← 唯一變因
```

**沒有** `CLAUDE.md`、沒有 `docs/EXPERIMENT-PROTOCOL.md`、沒有 `tests/`、
沒有 `.git`。session 不知道自己在被測什麼。

指令用預設路徑(讀 `schema.sql`),所以新舊兩版的呼叫方式完全一樣,
唯一的差別就是指令檔本身 —— 舊版根本沒有 `$ARGUMENTS`。

## 我下的 prompt(逐字)

```
claude -p "/check-schema" --allowedTools "Read,Grep,Glob" --model claude-opus-5
```

就這一句,沒有任何補充說明。

## 四組

| 組 | 指令版本 | docs 版本 | 受試 schema | 次數 |
|---|---|---|---|---|
| PAST | `c24ccbb` | `c24ccbb` | `bad-index.sql` | 3 |
| OLD | `c24ccbb` | 現行 | `bad-index.sql` | 1 |
| NEW(對照) | `d67c03d` | 現行 | `bad-index.sql` | 1 |
| PAST-GOOD(反向探針) | `c24ccbb` | `c24ccbb` | `good.sql` | 2 |

PAST 是真正的過去狀態 —— `c24ccbb` 當時的 `docs/spec.md` **完全沒有提過**
座位唯一性:

```
$ git show c24ccbb:docs/spec.md | grep -in "seat_no\|UNIQUE"
$ echo $?
1
```

零筆命中。座位釋放機制是 2026-09-10 才在 `d67c03d` 定案的。

## 它交出來的

原文全部在 `out/`,一個檔一次執行,沒有摘要、沒有剪裁:

| 檔 | 組 | 總分 | 第 4 條 |
|---|---|---|---|
| `out/past-1.md` | PAST | 6/8 | ❌ |
| `out/past-2.md` | PAST | 6/8 | ❌ |
| `out/past-3.md` | PAST | 6/8 | ❌ |
| `out/old-cmd-new-docs.md` | OLD | 7/8 | ❌ |
| `out/new-control.md` | NEW | 7/8 | ❌ |
| `out/past-good-1.md` | PAST-GOOD | 7/8 | ✅ |
| `out/past-good-2.md` | PAST-GOOD | 7/8 | ✅ |

`cmd-c24ccbb.md` 是舊版指令的逐字備份(免得日後 `git show` 麻煩)。

## 差異

**預測完全落空。** 舊版指令五次都沒放行:打壞的 schema 三次紅、打對的
schema 兩次綠。它跟現行版在第 4 條上判得一樣準。

`out/past-3.md` 那次的理由最赤裸:

> 4. ❌ **L6**:沒有 `UNIQUE(event_id, seat_no)`,只有部分索引 …

這是照字面判的。但 `out/past-good-1.md` 打正確的部分索引時,同樣的字面
規則卻判 ✅ —— 所以它並不是在做字串比對。

## 誰對,以及為什麼

**指令是對的,我的假設是錯的。**

原因:指令檔不是規則,是**指標**。真正在判的是模型,它會去讀 `docs/spec.md`、
會自己推理座位被確認之後索引項會不會釋放。所以會腐爛的從來不是那句
`UNIQUE(event_id, seat_no)`,是它指向的那份東西 —— 而在 OLD 那組,
`docs/spec.md` 已經追上了,`out/old-cmd-new-docs.md` 甚至直接引 spec 的
L160–167 當依據。

但 PAST 那組沒有這個解釋:spec 當時什麼都沒寫,它還是抓到了。
**那個紅燈來自模型自己的常識,不是來自我寫的任何一行。**

這比原本的假設難處理:

> 你以為紅燈來自你的規則,其實來自模型碰巧知道的事。
> 常識不受你控制,也不會通知你哪天它變了。

## 附帶發現:兩個裁判對 `good.sql` 不同意

同一份 `tests/fixtures/schema/good.sql`:

```
$ SCHEMA=tests/fixtures/schema/good.sql npx vitest run tests/schema.test.js
Test Files  1 passed (1)
     Tests  11 passed (11)
```

AI 跑 `/check-schema` 卻是 **7/8**,兩次都紅在第 7 條 —— `promo_codes` 不在
`docs/spec.md` 的 17 條 API 裡,也沒有任何表引用它。

**AI 那個是對的。** `tests/schema.test.js` 第 7 條只比對表名清單,
看不出「這張表沒有任何 API 用得到」。這是「能寫成程式碼的檢查就不要交給 AI」
(Day 6)的反向邊界:**需要跨檔案推論的檢查,寫成 grep 就只剩形狀。**

`tests/fixtures/schema/README.md` 說 `good.sql` 應該全綠 —— 那句話對 vitest
成立,對 `/check-schema` 不成立。兩個裁判的及格線本來就不同,但 README 沒說。
