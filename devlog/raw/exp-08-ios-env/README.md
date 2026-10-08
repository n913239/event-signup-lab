# 實驗 08:使用者的手機不是你的手機 —— iOS 五個畫面 × 五種環境(Day 28)

- 日期:2026-10-08;Xcode 16.4、iOS 18.5 模擬器;模型:claude-opus-5-5(`claude -p`,版本見 `claude-version.txt`)
- 對象:寫作 session 寫的 iOS 畫面(`c7cfe38` 起,現行 `HEAD` 的 `ios/EventSignup/Sources`)
- 後端:**本機** `wrangler dev` + `seed.sql`,示範資料照 T055 重建(示範活動:秋季音樂會,C3–C6,應付 444420 分)。不碰線上 Worker 與遠端 D1
- 量測程式:`EnvAuditTests.swift`(只放在暫時 worktree,沒進 `ios/App`):登入 → 活動 → 座位 → 我的票券 → 票券明細,每個畫面截圖並跑 `XCUIApplication.performAccessibilityAudit()`;
  問題一律記錄、不讓測試失敗,每筆一行 `AUDIT|環境|畫面|類型|描述|元件`(`audit/`)
- 五種環境:iPhone 16 Pro 預設 / 最大無障礙字級(AX XXXL)/ 深色;iPhone SE(第 3 代)預設 / 最大無障礙字級

## 1. 稽核(修之前)

| 環境 | 問題數 | 其中座位畫面 |
|---|---|---|
| 16 Pro 預設 | 131 | 110 |
| 16 Pro 最大字級 | 121 | 108 |
| 16 Pro 深色 | 134 | 114 |
| SE 預設 | 146 | 125 |
| SE 最大字級 | 106 | 93 |

大宗是座位格:`.font(.system(size: 9))` 寫死,字級放到最大還是 9pt(100 筆「Dynamic Type 不支援」,`screens/16pro-xxxl-3-seats.png`),加上色底配系統字色的對比不足。
另有幾類可疑:登入按鈕停用時的灰字(停用控制項不在對比要求內)、沒指到任何元件的「-」項目(活動列表、票券明細)。

稽核**抓不到**的:座位狀態只靠顏色分辨,VoiceOver 只念「A1」「C3」(稽核的元件標籤就是座號)。

## 2. 把稽核報告交給 AI 修(無菌室,`fix/`)

repo 外的空目錄(上層沒有任何 CLAUDE.md),只給八個畫面相關的 Swift 檔與 `audit-report.md`。權限 `Read,Edit,Write`,沒給 Bash。

- **第 1 輪**(`prompt-1.md`):「把你判斷是真問題的修掉;稽核也會誤報,你覺得不是問題、或需要我決定的不要改,列出來。」8 輪、$0.45、152 秒
  - 改了座位格(`.caption2` + `@ScaledMetric`、放不下就橫向捲動、有色底一律黑字)與票券明細的長標題
  - **自己加了**座位圖例與給 VoiceOver 的狀態(「A1 空位」「C3 我的」)—— 稽核沒報這一項
  - 登入停用、系統藍「登出」、所有「-」項目判為誤報或要人決定,沒改,逐條寫了理由
  - 另外指出稽核碰不到的:「離線資料」橘色小字對比約 2:1、錯誤訊息紅字偏低 —— 稽核時 App 不在離線或出錯狀態
- **C 輪**(`prompt-C.md`,接續同一個 session):回答它的問題(圖例保留、離線與錯誤改成對比夠的顏色、其餘照它的判斷)。7 輪、$0.59、60 秒;新增 `StatusText.swift`
- 兩輪都說「沒辦法編譯,也沒重跑稽核」

| 環境 | 修之前 | 第 1 輪後 | C 輪後 |
|---|---|---|---|
| 16 Pro 預設 | 131 | 24 | 24 |
| 16 Pro 最大字級 | 121 | 12 | 12 |
| 16 Pro 深色 | 134 | 20 | 20 |
| SE 預設 | 146 | 23 | 23 |
| SE 最大字級 | 106 | 10 | 10 |

- C 輪改的離線與錯誤顏色,稽核數字看不出來 —— 稽核時那兩種畫面不會出現,跟它自己說的一樣
- 剩下的是它判為誤報或沒指到元件的項目,**加上它自己加的圖例 4 筆**:四個標籤(空位／保留中／已售／我的)被報對比不足或差一點過;畫面上「空位」那格淺灰色塊在白底上幾乎看不見(`screens/cleanC-16pro-default-3-seats.png`)—— 修的時候引進了新問題,下一輪稽核抓到

## 3. 它的修改撞上我們自己的檢查(抓太寬)

兩輪都用了 `@ScaledMetric private var …: CGFloat` 讓格子跟著字級放大 —— 舊的 `check-money.sh` 把 Swift 的 `CGFloat` 當成金額浮點,紅燈。
`CGFloat` 是排版尺寸,金額不會用它:檢查拿掉 `CGFloat`(`Double` / `Float` / `Decimal` 照擋),self-test 補一個不誤報探針。記在 `devlog/LEDGER.md`。

## 4. Swift 6 嚴格併發(`swift6.txt`)

套件是 `swift-tools-version: 6.0`(Swift 6 語言模式)。手寫的 `Sources/EventSignup`:**0 error、0 warning**;40 個 warning 全在 swift-openapi-generator 產生的程式碼(public import 未使用)。

## 5. UI 測試會不會假綠燈(`walkthrough-*.txt`)

- 寫作 session 寫的 `LiveWalkthroughTests`(T055)對本機連跑 10 次:10/10 過,約 18 秒
- **突變**:把 `TicketListView` 的 `.task { await load() }` 註解掉,票券頁完全不載入 —— **測試照樣過**(`screens/mutant-tickets-empty-but-passed.png`)。它在 `sleep(3)` 之後只斷言「沒有出現『離線資料』」,空畫面也滿足
- 改成 `app.cells.firstMatch.waitForExistence(timeout: 20)`(活動列表與票券各一次,拿掉 `sleep`):突變版紅在「票券畫面是空的 —— GET /orders 沒回來」;正常版連跑 10 次 10/10,約 14 秒

## 附錄:第一次修的無菌室不乾淨(`appendix-contaminated/`)

第一次把「無菌室」開在 event-signup 的暫時 worktree 底下(`<worktree>/fix/run1`),Claude Code 會往上讀到 repo 的 `CLAUDE.md`(硬規則、靜態檢查)—— 不算無菌室。
那一次它在 C 輪提到「沒在這個 worktree 找到 `check-money.sh`」,就是從那裡知道的。第 2 節的數字全部來自 repo 外重跑的乾淨版;被汙染的那次照原樣留在附錄,不引用。
兩次的大方向一致(同樣的誤報判斷、同樣指出離線橘字);差別是汙染那次先問才加座位狀態,乾淨那次自己加了圖例。
