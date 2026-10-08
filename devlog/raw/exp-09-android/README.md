# 實驗 09:Android,AI 從契約開始寫(Day 28)

- 日期:2026-10-08;模型:claude-opus-5-5(`claude -p`,版本見 `claude-version.txt`);權限 `Read,Edit,Write`,**沒給 Bash**
- 無菌室:repo 外空目錄(上層沒有 CLAUDE.md),只放 `openapi.yaml` 與 `prompt.md` 的需求(三畫面、Compose、OpenAPI Generator 產 client、金額顯示成 `NT$4,444.20`、一支 instrumented UI 測試)
- 後端:**本機** `wrangler dev` + `seed.sql`,示範資料照 T055 重建(示範活動:秋季音樂會,C3–C6,444420 分)。模擬器 Pixel 8 / Android 15(`10.0.2.2:8788`)。不碰線上 Worker 與遠端 D1
- 工具:Gradle 8.9、JDK 21、AGP 8.7.3(AI 選的版本)

## 1. 寫出來(`ai-original/`)

40 輪、$2.64、745 秒;31 個檔案、Kotlin 1,348 行。回覆照實寫「完全沒有 build 過」,並列出「第一次 build 最可能要修的地方」。
Gradle wrapper 它寫不出來(`gradle-wrapper.properties` 被當成敏感檔擋下、jar 是二進位),請人跑 `gradle wrapper`。

## 2. 編起來(`build/`)

| 次 | 結果 | 交回給 AI |
|---|---|---|
| 1 | ❌ `:api` 編譯失敗:契約 `/health` 的 `ok: {type: boolean, const: true}`,OpenAPI Generator 產成 `enum class Ok(val value: Boolean) { TRUE("true") }` —— 型別 Boolean、值字串 | 錯誤原文 → 16 輪、$3.15、68 秒:用 `.openapi-generator-ignore` 排除;順手修了它讀產物時看到的 `LogoutRequest`(產生器只產 `RefreshRequest`) |
| 2 | ❌ 同一個錯(ignore 沒生效) | 錯誤原文 → 6 輪、$3.39、43 秒:改用 Gradle source set `exclude` |
| 3 | ✅ `assembleDebug` 過;AI 寫的單元測試 10/10 | — |

交回兩輪比第一次寫還貴:接續 session 要帶著前面整段對話。

## 3. 金額(`harness/MoneyFixtureProbe.kt`)

web 與 iOS 共用的 14 組向量(`tests/fixtures/money-format.json`),JVM 單元測試裡 `Locale.setDefault` 各跑一次:

| 語系 | 結果 |
|---|---|
| zh_TW | 9/14 |
| de_DE | 9/14 |

沒有跟著語系走(自己拆千分位,回覆裡主動說明「不吃裝置 locale」);紅的 5 組全是整數元多了 `.00`(prompt 沒給這條規則)—— 跟 exp-07 的 B 組一模一樣。

## 4. UI 測試

- AI 寫的 `DemoFlowTest` 對本機連跑 10 次:10/10,每次約 2.5 秒
- **突變**:`EventRegRepository.orders()` 改成回空清單 —— **測試照樣過**。它的設計是「沒有訂單就只檢查空狀態畫面,不算失敗」,而且在回覆裡事先寫了這一點

## 5. 五種環境(`audit/`、`harness/EnvAudit.kt`)

Google Accessibility Test Framework(`AccessibilityCheckPreset.LATEST`,只算 ERROR + WARNING),五個畫面各跑一次並截圖。量測用的副本把 Compose BOM 升到 2025.06.00 才有對應的測試相依;App 程式碼不變。

| 環境 | 修之前 | 修之後 |
|---|---|---|
| 預設 | 2 | 0 |
| 字級 2.0 | 1 | 0 |
| 深色 | 2 | 0 |
| 小螢幕(720×1280、density 320) | 1 | 0 |
| 小螢幕 + 字級 2.0 | **走不完**:鍵盤升起後「登入」被擠出畫面(`screens/before-small-font2-login-keyboard.png`) | 0,五個畫面都走完 |

- 修之前的 2 筆:座位圖左上角空白格是個沒有文字的無障礙節點(ERROR);「已售」白字配 `#9E9E9E` 對比 2.68(WARNING)
- 稽核**沒抓到**鍵盤蓋住按鈕 —— 是 UI 測試在那個環境下走不完才看到的。AI 寫的 `DemoFlowTest` 在小螢幕 + 字級 2.0 也紅,其他四種環境都綠
- 跟 iOS(exp-08)不同的地方:座位格的字用 `sp`,跟著字級放大;每格有「A1 已售」的 `contentDescription`、格內有「保/售/我」字樣、下方有圖例 —— 狀態不是只靠顏色。iOS 那份是寫作 session 寫的,這份是無菌室,條件不同,不拿來比誰比較好

## 6. 交給 AI 修(`fix/`)

無菌室放修好 build 的專案 + `audit-report.md`,同 exp-08 的指示(稽核也會誤報,不是問題或要人決定的不要改)。23 輪、$0.80、156 秒,改了 `SeatGrid.kt` 與 `LoginScreen.kt`(`a11y.diff`):
空白格換成 `Spacer`;「已售」改 `#616161`(約 6.2);登入表單可捲動、按鈕固定在底部貼著鍵盤。
沒改、列出來要人決定的:登入按鈕位置的外觀變了;TalkBack 可能把座位符號讀兩次(沒驗證)。說「沒編譯、沒重跑」。

修完重跑:五種環境稽核都 0;`DemoFlowTest` 五種環境都過。`android/` 是這一版。

## 7. Android Lint(`lint/`)

`./gradlew :app:lintDebug`(build 修好、無障礙修之前那一版):10 筆 Warning —— 8 筆依賴有新版、1 筆缺 App icon、1 筆 `DataExtractionRules`(建議 Android 12 以前另設 `fullBackupContent`;但 manifest 已有 `allowBackup="false"`,實際上已涵蓋)。
鍵盤蓋住登入、對比、測試假綠燈,lint 都沒報。

## 8. 讓 AI 補強 UI 測試(`testfix/`)

無菌室放第 6 節修好的專案,告訴它突變結果(訂單回空清單照樣過)與示範訂單的內容,只准改測試、沒給 Bash:
- 第 1 輪:13 輪、$0.43、79 秒 —— 空清單改成 `fail`、在列表裡找那張指定訂單(秋季音樂會、C3–C6、NT$4,444.20)再點、明細總計精確比對。**編譯失敗**:`import androidx.compose.ui.test.and`(`and` 是 `SemanticsMatcher` 的成員,不能這樣 import)
- 第 2 輪(貼回錯誤原文):3 輪、$0.49、10 秒,刪掉那行
- 驗證:正常版 × 10 → 10/10;突變版 → 紅(`票券列表是空的,但 demo 帳號應該有「秋季音樂會」的訂單`)

`screens/` 裡的 `before-default-3-seats`、`before-small-font2-login-keyboard`、`after-small-font2-1-login` 三張,10/08 晚上用 SystemUI demo 模式重拍(狀態列 LTE、10:00)。
