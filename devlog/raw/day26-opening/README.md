# Day 26:開賣那一秒(2026-09-27 線上實測)

對象:線上 Worker(`8a285e0` 部署;之後到 `7df00e2` 沒有任何 src / schema 變動)。

## 1. 三方時鐘對照(`scripts/clock-check.sh`,`clock-check.txt`)

本機、Worker 回應的 `Date` header、timeapi.io、cloudflare.com 的 `Date` header:四個來源同一秒(最後一個晚 1 秒,是依序呼叫的時間差)。

## 2. 開賣那一秒(`attempts.txt`)

1. 臨時帳號兩個(staff 一個、member 一個),密碼隨機、只存在本機暫存目錄;staff 用 SQL 升權限,跑完降回 member。
2. staff 建活動「day26-開賣那一秒」,`opens_at` = 建立當下的 `server_now` + 20 秒,截止在很遠的未來;票種名額 10。
3. member 對座位 A1 連續 `POST /events/:id/holds`:離開賣 3 秒以上每秒一次,之後不間斷(每次約 100 ms,就是一趟網路往返)。第一次 201 就停。
4. 跑完把活動截止(`POST /events/:id/close`),不留在開賣列表。

| | 回應的 `server_now − opens_at` | 結果 |
|---|---:|---|
| 最後一次被拒 | **−58 ms** | 409 `not_on_sale` |
| 第一次成功 | **+39 ms** | 201 |

- 開賣前回的是 `not_on_sale` 不是 `not_open_yet`:domain 的 `canHold` 分得出三種原因,但契約只有一個代碼,`src/routes/events.js` 一律回 `not_on_sale`(刻意,見該行註解)。
- **線上打不到「剛好等於 opens_at 的那一毫秒」**:兩次請求之間隔著約 100 ms 的往返,邊界落在 −58 與 +39 之間。剛好等於的那一格只有注入時間的單元測試測得到(`tests/domain/time-rules.test.js`「剛好等於開賣時刻 → ok」)。
