# Xcode 無障礙稽核結果(XCUIApplication.performAccessibilityAudit)

五個畫面 × 五種環境。每列:問題類型、筆數、被指到的元件(元件類型代碼:標籤;「-」表示稽核沒有指到具體元件)。

## iPhone 16 Pro・預設

- LoginView(登入)|Contrast failed|1 筆|9:登入
- EventListView(活動列表)|Dynamic Type font sizes are unsupported|9 筆|-
- EventListView(活動列表)|Text clipped|3 筆|-
- EventDetailView(座位)|Contrast failed|10 筆|48:A7, 48:E5, 48:E7, 48:F5, 48:F7, 48:G7 …
- EventDetailView(座位)|Dynamic Type font sizes are unsupported|100 筆|48:A1, 48:A10, 48:A2, 48:A3, 48:A4, 48:A5 …
- TicketListView(我的票券)|Contrast nearly passed|1 筆|9:登出
- TicketListView(我的票券)|Dynamic Type font sizes are partially unsupported|1 筆|9:登出
- TicketDetailView(票券明細)|Dynamic Type font sizes are unsupported|3 筆|-
- TicketDetailView(票券明細)|Dynamic Type font sizes are partially unsupported|1 筆|48:總計 NT$4,444.20
- TicketDetailView(票券明細)|Text clipped|2 筆|-, 48:示範活動:秋季音樂會

## iPhone 16 Pro・最大無障礙字級

- LoginView(登入)|Contrast failed|1 筆|9:登入
- EventListView(活動列表)|Dynamic Type font sizes are unsupported|4 筆|-
- EventListView(活動列表)|Text clipped|1 筆|-
- EventDetailView(座位)|Contrast failed|8 筆|48:A7, 48:D5, 48:D7, 48:E5, 48:E7, 48:F5 …
- EventDetailView(座位)|Dynamic Type font sizes are unsupported|100 筆|48:A1, 48:A10, 48:A2, 48:A3, 48:A4, 48:A5 …
- TicketListView(我的票券)|Dynamic Type font sizes are partially unsupported|1 筆|9:登出
- TicketDetailView(票券明細)|Contrast failed|1 筆|48:小計 NT$4,938・早鳥 0%・團體 10%
- TicketDetailView(票券明細)|Dynamic Type font sizes are unsupported|3 筆|-
- TicketDetailView(票券明細)|Text clipped|2 筆|-, 48:示範活動:秋季音樂會

## iPhone 16 Pro・深色

- LoginView(登入)|Contrast failed|1 筆|9:登入
- EventListView(活動列表)|Dynamic Type font sizes are unsupported|9 筆|-
- EventListView(活動列表)|Text clipped|3 筆|-
- EventDetailView(座位)|Contrast failed|14 筆|48:A7, 48:C3, 48:C4, 48:C5, 48:C6, 48:E5 …
- EventDetailView(座位)|Dynamic Type font sizes are unsupported|100 筆|48:A1, 48:A10, 48:A2, 48:A3, 48:A4, 48:A5 …
- TicketListView(我的票券)|Dynamic Type font sizes are partially unsupported|1 筆|9:登出
- TicketDetailView(票券明細)|Dynamic Type font sizes are partially unsupported|1 筆|48:總計 NT$4,444.20
- TicketDetailView(票券明細)|Dynamic Type font sizes are unsupported|3 筆|-
- TicketDetailView(票券明細)|Text clipped|2 筆|-, 48:示範活動:秋季音樂會

## iPhone SE・預設

- LoginView(登入)|Contrast failed|1 筆|9:登入
- EventListView(活動列表)|Dynamic Type font sizes are unsupported|9 筆|-
- EventListView(活動列表)|Text clipped|2 筆|-
- EventDetailView(座位)|Dynamic Type font sizes are unsupported|100 筆|48:A1, 48:A10, 48:A2, 48:A3, 48:A4, 48:A5 …
- EventDetailView(座位)|Contrast failed|25 筆|48:A4, 48:C4, 48:C7, 48:D4, 48:E2, 48:E3 …
- TicketListView(我的票券)|Dynamic Type font sizes are partially unsupported|1 筆|9:登出
- TicketListView(我的票券)|Contrast nearly passed|1 筆|9:登出
- TicketDetailView(票券明細)|Dynamic Type font sizes are partially unsupported|3 筆|-, 48:小計 NT$4,938・早鳥 0%・團體 10%, 48:總計 NT$4,444.20
- TicketDetailView(票券明細)|Dynamic Type font sizes are unsupported|3 筆|-
- TicketDetailView(票券明細)|Text clipped|1 筆|48:示範活動:秋季音樂會

## iPhone SE・最大無障礙字級

- LoginView(登入)|Contrast failed|1 筆|9:登入
- EventListView(活動列表)|Dynamic Type font sizes are unsupported|4 筆|-
- EventListView(活動列表)|Text clipped|1 筆|-
- EventListView(活動列表)|Contrast failed|1 筆|48:開賣 Jan 1, 1970 at 8:00 AM・截止 Jan 1, 2100 at 8:00 AM
- EventDetailView(座位)|Contrast failed|31 筆|48:A4, 48:C4, 48:C7, 48:D4, 48:E2, 48:E3 …
- EventDetailView(座位)|Contrast nearly passed|2 筆|48:G3, 48:H3
- EventDetailView(座位)|Dynamic Type font sizes are unsupported|60 筆|48:A1, 48:A10, 48:A2, 48:A3, 48:A4, 48:A5 …
- TicketListView(我的票券)|Dynamic Type font sizes are partially unsupported|1 筆|9:登出
- TicketDetailView(票券明細)|Contrast failed|1 筆|-
- TicketDetailView(票券明細)|Dynamic Type font sizes are partially unsupported|1 筆|-
- TicketDetailView(票券明細)|Dynamic Type font sizes are unsupported|2 筆|-
- TicketDetailView(票券明細)|Text clipped|1 筆|48:示範活動:秋季音樂會
