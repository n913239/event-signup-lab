Schema 已經設計好並跑過測試，全部寫在本地檔案：

- `schema.sql`：資料表、trigger 和 view
- `flows.sql`：保留、確認出票、取消、清理過期、驗票這幾個流程的 SQL 範本
- `test.sh`：用暫存 DB 跑主要情境

## 資料表

| 表 | 用途 |
|---|---|
| `events` | 活動資料、開賣時間、`hold_seconds`（保留幾秒，預設 600） |
| `ticket_types` | 票種、價格。`is_seated=1` 是劃位票，名額等於綁在這個票種的座位數；`is_seated=0` 是自由入座或站票，名額看 `quota` |
| `seats` | 每場活動各有一份座位，**鎖定狀態直接記在座位上**（`reservation_id`、`lock_expires_at`） |
| `reservations` | 保留單（也就是訂單）：`held` 之後會變成 `confirmed`、`expired` 或 `cancelled` |
| `reservation_items` | 一列是一張票，記下單當下的價格 |
| `tickets` | 確認後才產生，`reservation_item_id UNIQUE` 擋掉重複出票 |

## 主要設計決定

1. **過期是查詢時才判斷，不靠排程。** 保留有沒有過期，都是拿 `expires_at` 跟 `unixepoch()` 比。所以清理的排程（flows.sql 的 D 段）沒跑也不會算錯，它只是把過期單的狀態整理乾淨。
2. **搶位用一條條件式 UPDATE：**
   ```sql
   UPDATE seats SET reservation_id=:rid, lock_expires_at=:exp
    WHERE id=:seat_id AND (reservation_id IS NULL OR lock_expires_at <= unixepoch());
   ```
   `changes()=0` 代表位子被別人拿走了。座位的狀態只看兩個欄位：
   - 沒有 `reservation_id`：空位
   - `lock_expires_at` 還沒到：保留中
   - `lock_expires_at` 已經過了：當作空位
   - `lock_expires_at` 是 NULL：已售出
3. **非劃位票的名額由 trigger 擋。** 算佔用數時，已確認的加上還沒過期的保留都算，額滿就 `RAISE 'sold out'`。
4. **寫入一律用 `BEGIN IMMEDIATE`。** SQLite 同時只允許一個寫入者，交易一開始就拿寫鎖，兩個請求就不會同時讀到「還有位子」。
5. **確認出票**是一個交易，三步：
   - 先確認這張單還是 `held` 而且沒過期
   - 把座位鎖改成永久（`lock_expires_at=NULL`）
   - 產生 tickets
6. 其他 trigger 會擋這幾種情況：
   - 劃位票沒帶座位，或站票帶了座位
   - 座位不屬於這個票種
   - 座位沒被這張單鎖住
   - 超過每單上限
   - 票種屬於別場活動

## 測試結果（`bash test.sh`）

以下情境都符合預期：
- 同一個座位被第二個人搶，失敗
- 沒拿到鎖就直接插入明細，被 trigger 擋下
- 站票名額 2，買第 3 張時出現 sold out
- 過期的保留會被別人接手
- 重複出票被 UNIQUE 擋下
- 過期的單無法確認

## 目前沒做的部分

- 付款成功的通知如果在保留過期後才到，確認會失敗（`changes()=0`），這時要由應用程式走退款流程。
- 沒有會員表，只記聯絡人姓名和 email。要接會員系統的話，在 `reservations` 加 `user_id` 就可以。
- 場館座位範本（多場活動共用同一份座位圖）沒有拆出來。目前每場活動各存一份座位，建活動時從範本複製過去即可。