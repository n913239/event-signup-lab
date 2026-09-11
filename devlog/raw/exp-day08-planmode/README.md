# Day 8 實驗:Plan Mode 的計畫 vs 我先寫好的規格

**2026-09-11 實跑。** 原文 `PLAN.md`(136 行,一個字沒改)、`STDOUT.md`(session 的收尾訊息)。

## 無菌室怎麼準備的

```
git clone --no-hardlinks → checkout c24ccbb
rm docs/spec.md docs/non-goals.md
rm -rf .git                          ← 關鍵
claude --permission-mode plan -p "實作報名:成員可以選一個座位,系統保留十分鐘,逾時自動釋放,確認後出票"
```

prompt 是 Day 8 草稿紀律第 1 條寫死的那一句,一字未改。
**`CLAUDE.md` 照常留著** —— 這不是無菌室,是真實情境:量的是
「我已經把規則寫給它了,它會不會照做」。

> 🔴 **第一次跑失敗,而失敗的方式值得記。**
> 第一次只 `rm` 了工作樹,`.git` 還在。計畫最後一段自己招了:
> 「工作樹裡 `docs/spec.md`、`docs/non-goals.md` 是未 commit 的 deleted 狀態,
> **我從 HEAD 讀的**」—— 它讀到了完整規格,對照組當場失效。
> **「刪掉檔案」不等於「它看不到」,在 git repo 裡不成立。**
> 污染版留存在 `/tmp` 的 `exp-day08-CONTAMINATED/`。

## 對賬:endpoint

規格「保留與確認」三條 + 活動段的 `GET /events/:id`:

| 規格 | 計畫 | |
|---|---|---|
| `POST /events/:id/holds` | 有,TTL 600 秒 | ✅ |
| `POST /holds/:id/confirm` | 有,含 404 / 409 / 410 分流 | ✅ |
| `GET /events/:id` | 有,`remaining` 與 `status` 都以 `now` 計算 | ✅ |
| `DELETE /holds/:id`(主動放棄) | **沒有** | ❌ |

**3 命中 / 1 漏掉。**

## 對賬:五條硬規則

| 硬規則 | 計畫有沒有處理 |
|---|---|
| 1 金額整數 | ✅ `price_cents INTEGER NOT NULL CHECK (price_cents >= 0)` |
| 2 時間當參數 | ✅ `src/domain/` 零 `Date.now()`,`createApp({ now })`,`now` 是函式讓測試換假時鐘 |
| 3 併發寫進 `WHERE` + 檢查 `changes` | ✅ 三條 SQL 全在 `WHERE` 裁決、看 `meta.changes`,`UNIQUE` / `CHECK` 當第二道 |
| 4 簽章常數時間 | ➖ 不適用,它明講 JWT 不在這次範圍 |
| 5 價格快照 | ✅ `tickets.price_cents` 快照,註明「不 JOIN」 |

**四條適用的全部命中。**

## 對賬:必須被測試證明的規則

| 規格列的規則 | 計畫 | |
|---|---|---|
| `expired` 的 hold 不能 confirm | 有,且**打在 `now = expires_at` 的邊界**上 | ✅ |
| 不超賣 | 有,50 人閘門同搶一位 → 恰 1 個 201 | ✅ |
| 座位不重複 | 有,`UNIQUE(event_id, seat_no)` 第二道 | ✅ |
| 確認後金額不可變 | 做了快照,**但沒寫「改票價 → 重讀訂單」那個測試** | 🟡 |
| `on_sale` 之外不能建 hold | 沒有 | ➖ 見下 |
| 過了 `deadline_at` 不能報名 | 沒有 | ➖ 見下 |
| 未到 `opens_at` 不能報名 | 沒有 | ➖ 見下 |

> 後三條它**不是漏掉,是主動排除並寫進問題清單**:
> 「開賣時間窗(`canJoin(event, now)`)是 Day 26 的題目 → **這次不做**」。
> 它是從 `docs/EXPERIMENT-PROTOCOL.md` 的「時間判定 | Day 26」那一列推出來的 ——
> **repo 自己的文件替它劃了範圍。**

## ➕ 多做(踩非目標):0

它加了三張表、三個 endpoint、一個 cron trigger、一個 dev-only 認證中介層。
逐條對 15 條非目標,**一條都沒踩**。而且四項裡有三項它**先問過才加**。

## 🟡 加分(規格沒有,而它想到了)

1. **`CHECK ((status = 'free') = (hold_id IS NULL))`** —— 規格沒要求的完整性約束
2. **懶釋放為主 + cron 掃描為輔** —— 明講「正確性靠 `WHERE`,不依賴排程」,
   規格只寫「逾時自動釋放」沒指定機制
3. **`now = expires_at` 剛好相等視為過期**,並要求測試打這個點 —— 規格沒定義邊界
4. 🔴 **它指出規格自己矛盾**:`check-schema` 第 5 條要 `CHECK (remaining >= 0)` 欄位,
   但選位制下座位就是名額,再放計數器是**雙重帳**(懶釋放時會不同步)。
   它的預設是 `remaining` 算出來不存欄,**並明說「那條檢查會 ❌,由你決定要不要改」**。

## 結論

**七個問題、零範圍擴張、四條硬規則全中、一條 endpoint 漏掉。**

這次的結果落在 Day 8 草稿備用結論 C(「如果它全部命中」),但比 C 多一件事:
**它不只照做,還回頭指出規格的矛盾,而且沒有自己決定 —— 它把選擇權交回來。**

> Plan Mode 真正值錢的不是「它想得比我周全」,是
> **它把我規格裡對不起來的地方,在動手之前就攤在桌上。**
> 而那四個問題,我讀自己的規格讀了三次都沒看到。
