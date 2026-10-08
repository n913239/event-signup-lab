這個目錄是活動報名系統 iOS App(SwiftUI)的一部分。後端 API 的金額一律是整數「分」(欄位名 `*_cents`,例如 `total_cents`)。請在 `Money.swift` 寫票券畫面用的金額顯示:

```swift
public enum Money {
    public static func format(_ cents: Int) -> String
}
```

顯示格式:

- 前綴 `NT$`,整數的部分要有千分位
- 不是整數元時顯示兩位小數;整數元不顯示小數
- 負數的負號放在最前面

例子:`5 → NT$0.05`、`444420 → NT$4,444.20`、`100000 → NT$1,000`、`-12345 → -NT$123.45`。

金額路徑不准用浮點數(`Double`、`Float`、`Decimal`)。只寫這一個檔,不要寫測試。
