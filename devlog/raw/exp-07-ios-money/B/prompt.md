這個目錄是活動報名系統 iOS App(SwiftUI)的一部分。後端 API 的金額是整數「分」(`total_cents`)。請在 `Money.swift` 寫票券畫面用的金額顯示,把它轉成像 `NT$4,444.20` 這樣的字串:

```swift
public enum Money {
    public static func format(_ cents: Int) -> String
}
```

只寫這一個檔,不要寫測試。
