# 實驗 10:Android,讓 AI 自己 build、自己跑測試(Day 28)

- 日期:2026-10-08;模型:claude-opus-5-5(`claude -p`)
- 跟 exp-09 同一段需求(`prompt.md`),差別:
  1. **給執行權限**:`--allowedTools "Read,Edit,Write,Glob,Grep,Skill,Bash(./gradlew:*),Bash(gradle:*),Bash(adb:*),Bash(android:*)"` —— 只開這四類指令
  2. **Android CLI 的 skill** 裝在無菌室的專案裡(`android skills add android-cli --agent=claude-code --project=.`,不動全域設定);Android CLI 1.0.16500706
     - `ai-built/.claude/skills/android-cli/` 是 Google 的 [android/skills](https://github.com/android/skills)(Apache-2.0)原樣安裝的檔案,不是我們寫的;留著是為了重現實驗條件
  3. prompt 多告訴它:模擬器開著、後端在本機、示範帳號與「這個帳號已經有一張訂單」,並要求「都通過了再交卷」
- 無菌室在 repo 外(上層沒有 CLAUDE.md);後端本機 `wrangler dev` + seed;模擬器 Pixel 8 / Android 15
- 注意:Gradle 快取(`~/.gradle`)跟 exp-09 共用,它在回覆裡提到「版本都已在本機快取」—— 選了跟 exp-09 一樣的版本(AGP 8.7.3、Kotlin 2.0.21、Compose BOM 2024.12.01、OpenAPI Generator 7.10.0)

## 1. 它自己跑的迴圈(`run.json` 的 result)

125 輪、$4.25、800 秒;Kotlin 1,375 行。它自己:
- 建 wrapper(前兩次失敗:還沒有 settings 檔、還沒有 `app/`)
- 第一次 build 撞到同一個產生器問題(`/health` 的 `const: true`),用 `openapi-generator-ignore` 排除
- UI 測試第一次失敗(登入後在背景執行緒做導覽)、第二次失敗(測試自己的錯)、第三次過
- 用 `adb logcat`、`android layout`、`android screen capture` 找原因、用眼睛看四個畫面;從截圖發現明細頁「訂單編號跟標籤重疊」並修掉
- 最後 `clean` 從頭跑一次:單元測試 14/14、UI 測試 1/1

被權限擋下 9 次(`cd …`、`printenv`、`curl`、`ls ~/.gradle/…`、`sed -i` 等不在白名單的指令),它都改用允許的工具繞過。

## 2. 我重跑(`verify/`)

| | 結果 |
|---|---|
| build + 單元測試 | ✅ 14/14 |
| 金額共用 14 組向量(zh_TW / de_DE) | 9/14 / 9/14(`DecimalFormat` 但釘死 `Locale.US`,不跟語系;整數元多 `.00`) |
| UI 測試對本機 × 10 | 10/10,約 2.2 秒 |
| 突變:`listOrders()` 回空清單 | ❌ **紅**(15 秒內等不到 `order_item`)—— 它要求一定要有訂單;但 prompt 有告訴它帳號已有一張訂單,exp-09 沒有,這個差別不能全算在「自己跑」 |
| ATF 五環境(ERROR + WARNING) | 預設 1、字級 2.0 1、深色 1、小螢幕 1:都是登入按鈕停用時的灰字(對比 2.26,停用元件不在對比要求內) |
| 小螢幕 + 字級 2.0 | **走不完**:鍵盤蓋住「登入」(`screens/small-font2-login-keyboard.png`)—— 它自己的 UI 測試在這個環境也紅;沒有人叫它換環境,它也沒去試 |
| Android Lint | 34 筆:27 依賴有新版、3 AGP 有新版、1 `ApplySharedPref`、1 缺 icon、1 `DataExtractionRules`;**唯一的 Error `ProduceStateDoesNotAssignValue` 是誤報**(`Loadable.kt` 的 `produceState` 裡有 `value = try { … }`) |
