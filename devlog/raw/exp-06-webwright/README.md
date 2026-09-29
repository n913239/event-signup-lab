# 實驗 06:讓 AI 走查 web 畫面(Day 29)

- 日期:2026-09-28
- 工具:[microsoft/Webwright](https://github.com/microsoft/Webwright) @ `bc26750`(2026-08-03)。AI 不一步一步點,而是自己寫 Playwright 腳本、跑、看截圖,最後留下一支可重跑的 `final_script.py`
- 受測:本 repo @ `8bd9959` 的本機複本(`<lab>`),`wrangler dev` :8788 + vite :5173,`seed.sql` 的 member 帳號。**全部只打本機**
- 任務(每一輪相同,`runN/prompt.md` 逐字):登入 → 進「秋季音樂會」→ 用「一般」票種保留一個座位 → 確認 → 到「我的票券」確認看得到。回報座位號、金額、票券頁內容
- 偏離 Webwright 預設:Playwright 的 Firefox 下載逾時,改用本機 Chrome(`chromium.launch(channel="chrome")`)
- 路徑已換成代稱:`<lab>` 受測複本、`<webwright>` Webwright clone、`<workdir>` 每輪的工作目錄

## 突變

`web/src/lib/money.js` 的 `formatCents` 把 `/ 100` 改成 `/ 10` —— 資料庫和 API 都對(一般票 `price_cents = 100000` = NT$1,000),**只有畫面顯示成 NT$10,000**。run1 在原版上跑,其餘都在突變版上跑。

## 結果

| run | 設定 | 花費 | 流程做完 | 抓到 ×10 | 留下的腳本重跑會紅 |
|---|---|---|---|---|---|
| 1 | Claude Code(claude-opus-5-5)+ Webwright plugin,原版 | $0.64、19 輪、2 分鐘 | ✅ A1 | —(原版) | — |
| 1 重跑 | 把 run1 的 `final_script.py` 在突變版上重跑 | — | ✅ | ❌ log 照實記 NT$10,000 | ❌ exit 0 |
| 2 | 同 run1,突變版 | $0.57、16 輪、2.8 分鐘 | ✅ A4 | ❌ 回報「訂單金額 NT$10,000」 | ❌ |
| 3 | 同上 + 唯讀 SQLite MCP(`mcp-sqlite`,指向本機 D1);prompt 只說「有掛這個 MCP」 | $0.67、19 輪、4 分鐘 | ✅ A1 | ❌ **沒用 MCP** | ❌ |
| 3b | 同上,任務多一句「畫面上的金額要跟資料庫裡的票價對得上」 | $0.74、25 輪、4 分鐘 | ✅ A2 | ✅ 查 DB、指出 `formatCents` 除以 10 | ❌ 比對只在 log,62 行腳本零斷言 |
| 4a | Webwright 自己的 harness + 地端 `qwen3.6-35b-a3b-mlx`(LM Studio)。**設定錯誤:venv 不在 PATH** | 本機 | ❌ 28 步沒開過瀏覽器 | — | — |
| 4b | 同上,PATH 修好 | 本機、34 分鐘、26 步 | ❌ **只保留 C1,沒按確認** | ❌ | ❌ |
| 5 | Pi coding agent + 同一個地端模型,prompt 叫它先讀 Webwright 的 `SKILL.md` 再照做 | 本機、16 分鐘 | ✅ B1 | ❌ | ❌ 零斷言 |
| — | `e2e/member-ticket.spec.js`:沿用 run1 的流程與選擇器,期望值來自 seed(NT$1,000) | 0.6 秒 | ✅ | ✅ | ✅ `Expected "NT$1,000"` / `Received "一般・NT$10,000・剩 59"` |

## 值得看的地方

1. **流程做完 ≠ 做對。** 除了 run4,每一輪都真的完成了訂票,每個檢查點都附了截圖或 log。但任務沒說金額應該是多少,它就把畫面上的數字當事實回報。
2. **給了工具,不等於會用。** run3 掛了能查資料庫的 MCP,它讀了前端原始碼、沒查資料庫。run3b 只是任務裡多一句驗收條件,它就去查、抓到、還指出是哪一行。
3. **抓到了,也沒留下來。** run3b 的比對是 agent 自己寫進 log 的;它留下的 `final_script.py` 沒有斷言、不查資料庫,下次重跑照樣綠。
4. **假成功(run4b)。** 它只保留了 C1(資料庫裡是 `holding`),從沒按「確認」。`run4/screenshots/final/final_execution_6_order_confirm.png` 檔名叫 order_confirm,畫面卻停在「保留 C1」、倒數 09:56;Webwright 內建的 `self_reflection`(同一個地端模型)給這張 5 分、理由寫「Order confirmed」,整輪判 `predicted_label: 1`。最後的報告拿先前的 A1/A2 訂單當票券內容。
5. **小模型開 shell(run4a)。** 環境不對時,它沒想到是 PATH,而是反覆 `find /` 掃整台主機找 playwright(`run4/4a-nopath/command_history.sh`)。Webwright 的 harness 只限制工作目錄,沒有沙箱;這次跑在主機上是作者評估過的取捨(lab 目錄是拋棄式的),要常態使用請放進 VM 或容器。

## 檔案

- `runN/`:prompt、`plan.md`、`final_script.py`、`final_script_log.txt`;run1–3b 另有 `result.md`(agent 的最後回覆與花費;run1、run2 的是 9/28 事後從執行紀錄補存)、run3 有 `mcp.json`;run4 有 harness 的指令歷史、`self_reflect_result.json` 和最後回覆;run5 有 agent 的最後回覆(`pi.log`)
- `runN/screenshots/`:`final/` 是正式那次執行、`explore/` 是探索階段,檔名照 agent 自己取的
- `e2e/`:改寫後的 `@playwright/test`。**不在 `npm test` 和 CI 裡**(要瀏覽器和兩個 dev server);重跑方式:把兩個檔放到 repo 根目錄、`npm i -D @playwright/test`、`npm run dev` + `cd web && npx vite`、`npm run db:seed`、`npx playwright test`
- run1、run2 的截圖沒有留

**Day 29 的重點:AI 走查能把流程跑完,也能留下一支好用的腳本 —— 但「對」是什麼,得有人先寫下來。換模型、加工具都沒改變這件事;唯一會一直紅的,是期望值寫死在測試裡的那一支。**
