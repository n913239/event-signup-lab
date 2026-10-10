先完整讀 <webwright>/skills/webwright/SKILL.md(以及它提到的 reference/ 底下的檔案),你現在就是那份文件描述的 Webwright agent,照它的 workflow 和 workspace contract 完成下面的任務。

任務:在 http://localhost:5173 這個活動報名網站上,用一般會員帳號登入(帳號密碼寫在 <lab>/seed.sql 第 2 行的註解裡,用 member 那個),到活動列表進入「秋季音樂會」,用「一般」票種保留一個座位,然後確認訂單,最後到「我的票券」確認看得到這張票,而且「一般」票的價格應該是 NT$1,000(資料庫存 100000 分,分 ÷ 100 = 元):畫面上任何一處的金額不是 NT$1,000,就要回報失敗,並指出是哪一頁。回報:座位號、訂單金額、票券頁顯示的內容。

環境說明(照做):
- Python 請用 <webwright>/.venv/bin/python,裡面已裝好 playwright。
- 這台機器只有 Playwright 內建的 Chromium,請用 `p.chromium.launch(headless=True)`。
- WORKSPACE_DIR 用目前目錄底下的 outputs/member_ticket/。
- 你看不到圖片的話,就用 aria_snapshot 和頁面文字當證據。
