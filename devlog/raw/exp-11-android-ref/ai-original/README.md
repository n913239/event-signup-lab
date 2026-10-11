# 活動報名系統 Android App

Kotlin + Jetpack Compose(minSdk 26、compileSdk 35)。三個畫面:登入、活動列表(含 10×10 座位圖,唯讀)、我的票券(含明細與 QR)。
畫面和行為對照 `ios-reference/`。

## API client

- 從根目錄的 `openapi.yaml` 用 OpenAPI Generator Gradle plugin 產生(`kotlin` / `jvm-retrofit2` / gson / suspend),
  輸出在 `app/build/generated/openapi/`,`preBuild` 會先跑 `openApiGenerate`。不進版控,也不手寫 HTTP 呼叫。
- API 位址:`BuildConfig.API_BASE_URL`,預設 `http://10.0.2.2:8788`(模擬器連開發機的 wrangler dev)。
  覆寫:`-PapiBaseUrl=https://...`。http 只對 `10.0.2.2` / `localhost` / `127.0.0.1` 放行
  (`app/src/main/res/xml/network_security_config.xml`)。

## 第一次建置

專案沒附 `gradlew` / `gradle-wrapper.jar`,先產生一次(需要本機有 Gradle 8.x 與 JDK 17):

```sh
gradle wrapper --gradle-version 8.11.1
```

或直接用 Android Studio 開這個資料夾,它會處理 wrapper。

```sh
./gradlew openApiGenerate      # 只產生 client,看產出的 API / model
./gradlew assembleDebug        # 建 APK:app/build/outputs/apk/debug/app-debug.apk
./gradlew installDebug         # 裝到開著的模擬器
./gradlew testDebugUnitTest    # JVM 單元測試(金額格式)
```

## Instrumented UI 測試(登入 → 活動 → 票券)

前提:後端在開發機 8788 跑著(`wrangler dev --local`)、模擬器開著、示範帳號至少看得到一個 on_sale 活動與一張訂單。

```sh
./gradlew connectedDebugAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.DEMO_EMAIL='demo@example.com' \
  -Pandroid.testInstrumentationRunnerArguments.DEMO_PASSWORD='********'
```

沒給帳密時測試會標成 skipped,不會失敗。報告:`app/build/reports/androidTests/connected/index.html`。
