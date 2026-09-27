# Day 29:在 event-signup 的 iOS 專案上重跑 Xcode MCP(2026-09-27)

- Xcode **27.0(27A5237l)**,`xcrun mcpbridge` 帶 `MCP_XCODE_PID`(這台同時裝了 16.x / 26.x / 27,不設會連錯版)
- `serverInfo`:`xcode-tools` 25280.8;**工具數 53**(與 2026-09-08 量的 27 beta 5 相同)
- 專案:`ios/App/EventSignupApp.xcodeproj`(xcodegen 產生,依賴 `ios/EventSignup` 這個 SwiftPM package);scheme 的測試只有 UI 測試 `LiveWalkthroughTests`
- 呼叫腳本:`mcpcall.py`(同一個 mcpbridge process 內依序呼叫;中間可插 shell 指令改檔)

## 結果

| 狀況 | `BuildProject` | `RunAllTests` |
|---|---|---|
| 正常 | 成功(22.7s) | `passed 0 / failed 0 / skipped 1 / notRun 0 / total 1` —— UI 測試在 Xcode 裡拿不到 DEMO 帳密,`XCTSkip` |
| 在 `Money.swift` 尾端塞 `let brokenOnPurpose: Int = "not an int"` | 失敗,`errors` 指到 `Money.swift:25`「Cannot convert value of type 'String' to specified type 'Int'」 | **`isError: true`**,`"Build action failed. Inspect build logs."`,沒有 counts |
| 還原 | 成功(1.9s) | 同第一列 |

1. **建置失敗時,27.0 的 `RunAllTests` 回的是錯誤,不是一組全 0 的計數。** 這條路徑不會被誤判成綠。
2. **會騙人的是「全部跳過」**:`failed: 0` 且 `passed: 0`。只檢查 `failed == 0` 會判綠;檢查 `passed == total − disabled` 才會紅(0 ≠ 1)。Day 29 寫進 CI 的那條規則,在這裡換了一個形狀出現。
3. 前兩次「建置失敗」跟程式碼無關:① Xcode 裡 OpenAPIGenerator build plugin 還沒啟用(作者在 Xcode 裡按了啟用);② 執行目標是實機,卡在簽署需要 development team。兩次 `RunAllTests` 都一樣回 `isError`。切到模擬器(`XcodeSwitchRunDestination`)後才是上表。
4. **授權是綁 process 的**:每開一個新的 mcpbridge process,Xcode 就跳一次「Allow "probe" to access Xcode?」(顯示 Python 的路徑與 PID)。這次為了逐步試,作者按了 6–7 次。要少按,就在同一個 process 裡把整組呼叫做完。

`responses.txt`:第二次(切到模擬器後)那一組的原始回應,本機路徑、暫存路徑與實機名稱已遮;每則回應在印出時截在 3000 字(切換執行目標那則截在 400 字)。
