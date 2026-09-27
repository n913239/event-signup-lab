# CLAUDE.md — 活動報名系統

## 這個專案是什麼

活動報名系統。對外叫報名,對內跑的是**售票的規則**:
限量名額、搶、狀態機、逾時釋放。差別只在收不收錢,而我們不收錢(非目標 3)。

## 硬規則(違反 = CI 紅燈,不是風格問題)

1. **金額一律用整數最小單位。** 金額路徑出現浮點 = CI 紅燈。
   顯示轉換(分 → 元)只准在三個地方:API 的 `src/presentation/`、web 的 `web/src/lib/money.js`、
   iOS 的 `Tickets/Money.swift`(2026-09-27;三處都在 `check-money.sh` 的範圍內)。
2. **時間是參數,不是副作用。** `src/domain/` 不准出現 `Date.now()` / `new Date()`;
   `now` 從外面傳進來。讀時鐘只准在兩個入口:`src/app.js`(注入 `now`,routes 一律用 `c.get('now')`)
   與 `src/worker.js`(Cron)。SQL 不自己取時間(`unixepoch()` 等),時間用 `?` 綁進去;
   不用 `hono/jwt`(它的 verify 內部自己讀時鐘)。
3. **併發判斷必須在 SQL 的 `WHERE` 裡**,不能在應用層先查再寫。
   條件式寫入 + 檢查 `changes`,並用 `CHECK` 當第二道防線。
4. **簽章比對必須是常數時間。** 不得自己重算 HMAC 再 `===`。
5. **確認後的訂單金額不可變。** 明細要存價格快照,不是 JOIN 即時算。

每一條都要有裁判 —— 沒有裁判的規則等於沒有規則:

| 規則 | 裁判 |
|---|---|
| 1 金額整數 | `scripts/check-money.sh` |
| 2 時間當參數 | `scripts/check-time-injection.sh` |
| 3 併發寫進 `WHERE` | `scripts/check-concurrency.sh` |
| 4 常數時間比對 | `scripts/check-jwt-timing.sh` |
| 5 價格快照 | `scripts/check-price-snapshot.sh` + `tests/schema.test.js` ⑥,見下 |

`scripts/self-test.sh` 負責證明上面每一支都真的抓得到 ——
一支從不亮紅燈的檢查,跟沒有檢查是同一件事。

> 規則 5 由兩支裁判分工:`check-price-snapshot.sh` 管「**沒有任何 `UPDATE` 可以寫入金額欄**」
> —— 金額只在建單那次 `INSERT` 寫進去;另一半「明細要存快照,不是靠 `ticket_type_id` JOIN 即時算」
> 由 `tests/schema.test.js` ⑥ 裁判(要求 `order_items` 有自己的 `_cents` 欄)。
> (舊註記說這一半「還沒有自動檢查」,`schema.sql` 落地後已過時,2026-09-27 改。)

## 目錄

```
src/domain/        純邏輯,無 I/O,時間與亂數都從參數進來
src/routes/        Hono handler,驗身分;現在時間用 c.get('now')(app.js 注入)
src/lib/           有 I/O 的共用模組:JWT、HMAC、密碼雜湊、db/(SQL 存取)—— 不進 domain
src/presentation/  顯示轉換(API 側唯一可以做金額除法的地方;web / iOS 各有一個檔,見硬規則 1)
tests/helpers/     閘門等測試基礎設施
scripts/           靜態檢查與壓測
devlog/            每天記 AI 交出什麼(原文,不要轉述)
docs/              spec / non-goals / verified / 實驗紀律
```

## 不做的事

見 `docs/non-goals.md`,15 條。**不要主動加表、加欄位、加 endpoint。**
你認為缺的東西,先問。

## 提交

- 一個變更一個 commit,message 用中文
- **不要加 `Co-Authored-By` 或任何 AI 署名 trailer**
- 實驗性質的 commit,message 要寫明「AI 尚未介入」或「AI 版」

## 寫測試

- 先寫一個會紅的測試,再動手
- 併發測試一律用 `tests/helpers/gate.js` 的閘門,不要用隨機延遲
- **不穩定的重現 = 沒有重現**,併發測試要能重跑 5 次結果一致
