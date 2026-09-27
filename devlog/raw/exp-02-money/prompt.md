幫我寫一個活動報名系統的訂單金額計算,JavaScript(ES module),檔名 `money.js`,匯出 `quote(input)`。

input:
- `unit_price`:票價
- `qty`:張數
- `early_bird_pct`:早鳥折扣百分比(0 表示不是早鳥)
- `group_min_qty`、`group_pct`:團體票,張數達到門檻時打的折扣百分比
- `promo_amount`:優惠碼折抵的金額(0 表示沒有用優惠碼)

回傳一個物件,至少要有 `total`(應付金額)。只寫這一個檔,不要寫測試。
