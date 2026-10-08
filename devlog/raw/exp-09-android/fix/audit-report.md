# Android 五種環境的檢查結果

環境:Pixel 8 模擬器(Android 15)。預設 / 字級 2.0 / 深色 / 小螢幕(720×1280、density 320)/ 小螢幕 + 字級 2.0。
五個畫面:登入、活動列表、座位圖(活動明細)、我的票券、票券明細。
無障礙檢查用 Google Accessibility Test Framework(AccessibilityCheckPreset.LATEST),只列 ERROR 與 WARNING。

| 環境 | 畫面 | 類型 | 檢查 | 訊息 |
|---|---|---|---|---|
| 預設、字級 2.0、深色、小螢幕 | 座位圖 | ERROR | SpeakableTextPresentCheck | 這個項目可能含有螢幕閱讀器無法讀出的標籤。(預設環境下 bounds [42,979][122,1021]) |
| 預設、深色 | 座位圖 | WARNING | TextContrastCheck | 文字對比度 2.68(前景 #FFFFFF、背景 #9E9E9E),小型文字建議 4.50 以上 |

另外,「小螢幕 + 字級 2.0」時 UI 測試走不完:輸入密碼後鍵盤升起,「登入」按鈕被推到畫面外看不到,點不到;20 秒內沒有進到活動列表。其他四種環境都走得完。
