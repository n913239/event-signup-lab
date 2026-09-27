用 JavaScript(ES module)寫 `src/domain/time-rules.js`,給一個活動報名系統用。匯出四個函式:

- `canHold`:判斷一個活動現在能不能讓人保留座位。活動有 `status`(`draft` / `on_sale` / `closed` / `finished`)、`opens_at`(開賣時間)、`deadline_at`(截止時間),時間都是 epoch 毫秒。只有 `on_sale`、已經開賣、還沒截止才可以。回傳 `{ ok: true }`,或 `{ ok: false, reason }`,`reason` 是 `not_on_sale` / `not_open_yet` / `deadline_passed` 其中之一。
- `isEarlyBird`:票種有 `early_bird_until`(epoch 毫秒,可能是 null),判斷現在是不是早鳥期間。
- `isHoldExpired`:保留有 `expires_at`(epoch 毫秒),判斷這個保留是不是已經過期。
- `holdExpiresAt`:給保留時長(分鐘),算出這個保留的到期時刻(epoch 毫秒)。

只寫這一個檔,不要寫測試。
