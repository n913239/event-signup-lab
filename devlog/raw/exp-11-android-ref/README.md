# 實驗 11:Android,多給一份 iOS 參考實作(Day 28 補跑)

- 日期:2026-10-12;模型:claude-opus-5-5(`claude -p`,版本見 `claude-version.txt`);權限 `Read,Edit,Write`,**沒給 Bash**(同 exp-09)
- 無菌室:repo 外空目錄,放 `openapi.yaml`(與 exp-09 同一份)、**`ios-reference/`(本 repo `ios/` 在 `5cc9029` 的原樣)**、`prompt.md`
- prompt:exp-09 原文只多一句「同目錄的 `ios-reference/` 是同一個系統已經完成的 iOS App(SwiftUI),畫面和行為可以參考它。」
- 只跑一次。後端本機 `wrangler dev` + `seed.sql`,另用 API 讓 member 帳號訂一張(C3、C4);模擬器 Pixel / Android 15

## 結果(對照 exp-09)

| | exp-09(只有契約和需求) | exp-11(多給 iOS) |
|---|---|---|
| 生成 | 40 輪、$2.64、745 秒、Kotlin 1,348 行 | 44 輪、$2.53、621 秒、Kotlin 1,286 行(`ai-original/`) |
| 第一次 build | ❌ `/health` 的 `const: true` 產出型別不合;`LogoutRequest` 不存在 | ❌ **同樣兩個錯**(`build/build-1.log`) |
| 修 build | 交回 AI 兩輪,$6.53 | **人工**照 exp-09 的繞法改(`build/human-fix.diff`),不另花 AI |
| 金額向量(zh_TW / de_DE) | 9/14、9/14(整數元多補 `.00`) | **14/14、14/14**(`harness/MoneyFixtureProbe.kt`;AI 註解「跟 iOS 的 Money.format 逐字相同」) |
| UI 測試 | 正常 10/10;空清單突變**照樣過** | 正常 3/3(各約 4.3 秒,skipped 0);空清單突變**紅**(`ComposeTimeoutException`,等不到票券列)(`ui/`) |
| 座位格子 | 顏色 +「保／售／我」字樣 | **只有顏色**(跟 iOS 一樣);螢幕閱讀器說明它自己加了 |

- UI 測試另有一行人工修正:漏了 `import androidx.compose.ui.semantics.getOrNull`,編不過(在 `human-fix.diff` 裡)
- AI 回覆說 UI 測試是「參考 iOS 測試註解裡記錄過的『畫面全空測試照樣綠』」
- `ios/` 的座位圖仍是修無障礙之前的版本(固定 9pt、只靠顏色;exp-08 的修正沒有合回 `ios/`)—— AI 參考的就是這一版。Android 用的是 `9.sp`,會跟著字級放大,這一點沒有照抄
- 沒跑五種環境的無障礙稽核

**一句話**:參考實作替空白填了答案 —— 金額規則、測試寫法這種做得好的照抄了,座位只靠顏色這種沒做好的也照抄了;契約和產生器的坑,它幫不上。
