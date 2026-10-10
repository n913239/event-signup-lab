/webwright:run 在 http://localhost:5173 這個活動報名網站上,用一般會員帳號登入(帳號密碼寫在 <lab>/seed.sql 第 2 行的註解裡,用 member 那個),到活動列表進入「秋季音樂會」,用「一般」票種保留一個座位,然後確認訂單,最後到「我的票券」確認看得到這張票,而且畫面上的金額要跟資料庫裡的票價對得上。回報:座位號、訂單金額、票券頁顯示的內容。

環境說明(照做):
- Python 請用 <webwright>/.venv/bin/python,裡面已裝好 playwright。
- 這台機器無法下載 Playwright 的 Firefox,請改用 `p.chromium.launch(channel="chrome", headless=True)`,其餘照 Webwright 的規則。
- WORKSPACE_DIR 用目前目錄底下的 outputs/member_ticket/。
