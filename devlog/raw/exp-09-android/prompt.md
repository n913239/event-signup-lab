這個目錄要做活動報名系統的 Android App。後端 API 的契約是同目錄的 `openapi.yaml`。請建一個完整的 Gradle 專案:

- Kotlin + Jetpack Compose,minSdk 26、compileSdk 35
- API client 用 OpenAPI Generator 的 Gradle plugin 從 `openapi.yaml` 產生,不要手寫 HTTP 呼叫
- API 位址放在 `BuildConfig.API_BASE_URL`,預設 `http://10.0.2.2:8788`(模擬器連本機)
- 三個畫面:
  1. 登入:email + 密碼,登入後保存 access token 與 refresh token
  2. 活動列表:`GET /events?status=on_sale`,顯示名稱、開賣與截止時間、剩餘席數;點進去看 10×10 座位圖(四種狀態:空位、保留中、已售、我的),唯讀
  3. 我的票券:`GET /orders`,列表顯示活動名稱、座號、金額、狀態;點進去看明細
- 金額欄位一律是整數「分」(`*_cents`),畫面上顯示成像 `NT$4,444.20` 這樣
- 寫一支 instrumented UI 測試,走一遍 登入 → 活動 → 票券;帳密從 instrumentation arguments 讀(`DEMO_EMAIL` / `DEMO_PASSWORD`)

你沒辦法執行指令。寫完之後,列出我該怎麼 build、怎麼跑測試。
