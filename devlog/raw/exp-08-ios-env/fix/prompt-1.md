這個目錄是活動報名系統 iOS App(SwiftUI)的畫面程式碼(`src/`)。`audit-report.md` 是用 Xcode 的無障礙稽核(`XCUIApplication.performAccessibilityAudit`)在五種環境下跑出來的結果。請直接修改 `src/` 裡的檔案,把你判斷是真問題的修掉。

- 稽核也會誤報。你覺得不是問題、或需要我決定的,不要改,列在回覆最後並說明理由。
- 不要改 API 呼叫與金額格式(`Money.swift` 不動)。不要寫測試。
