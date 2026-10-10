# 實驗 06b:驗收條件 × 不同模型(Day 29 補跑)

- 日期:2026-10-09 晚 ~ 10-10
- 為什麼補跑:[exp-06](../exp-06-webwright/) 的 run3b 是「MCP + 驗收條件」一起給才抓到 ×10,地端兩條只給了基本任務。這次把同一句驗收條件給每一種組合
- 受測:本 repo @ `8bd9959` 的複本(`<lab>`),跟 exp-06 一樣把 `web/src/lib/money.js` 的 `/ 100` 改成 `/ 10`(畫面金額 ×10)。**每輪開跑前重灌本機 D1**(exp-06 是沿用前幾輪的狀態)
- Webwright `bc26750`、Pi coding agent 0.84.2;全部只打本機
- 路徑已換成代稱:`<lab>` 受測複本、`<webwright>` Webwright clone、`<workdir>` 這個資料夾;log 裡的 lab 登入 token 換成 `<jwt>` / `<redacted>`(本機隨機金鑰簽的,lab 已刪)

## 任務

exp-06 的原任務加一句「**而且畫面上的金額要跟資料庫裡的票價對得上**」。逐字見 `prompt-a.md`(Claude,拿掉 MCP 那行)、`task-b.md`(Pi)、`task-c.txt`(Webwright harness)。

| 代號 | 組合 | 在哪跑 |
|---|---|---|
| a | Claude Code + Webwright plugin(`run-claude.sh`,`claude -p --plugin-dir`,`--allowedTools Bash,Read,Write,Edit,Glob,Grep,Skill`) | 主機,Chrome channel |
| b | 地端模型 + Pi,先讀 Webwright 的 `SKILL.md` 再照做 | Docker 容器 |
| c | 地端模型 + Webwright 自己的 harness | Docker 容器 |

- 容器(`Dockerfile`):受測站與 agent 在同一個容器,只掛 `/work`(輸出)與 `/cfg`(唯讀設定),看不到主機的家目錄。用 Playwright 內建的 Chromium(exp-06 是本機 Chrome),任務的環境說明跟著改
- 地端模型都在主機的 LM Studio 上;LM Studio 開了驗證,主機上用一支只補 `Authorization` 的轉發程式讓容器連過去(綁本機設定,不附)
- 模型:`qwen3.6-35b-a3b-mlx`(同 exp-06)、`qwen3.8-27b-mlx`(8-bit dense)、`laguna-xs-2.1`(lmstudio-community GGUF Q8_0,沒指定取樣參數)
- 時限:每輪 90 分鐘(`b38-L1` 放寬到 240 分鐘,71 分鐘時手動停掉換 Laguna)

## 結果(全部在突變版上、任務都有驗收條件、都沒掛 MCP)

| run | 組合 | 時間 | 流程做完(DB 最後狀態) | 抓到 ×10 | 備註 |
|---|---|---|---|---|---|
| a1 | Claude | $0.72、20 輪、4.3 分 | ✅ A1 confirmed | ✅ 唯讀查 sqlite,指出 `money.js:6` | 85 行腳本,零斷言 |
| a2 | Claude | $0.70、17 輪、4.9 分 | ✅ A1 confirmed | ✅ DB / API / 畫面三方對照 | 108 行腳本,零斷言 |
| b1 | qwen3.6 + Pi | 11.3 分 | ✅ A1 confirmed | ❌ 讀到 100000,寫「因臺灣十進位制 分→新臺幣為 ÷10」判相符 | |
| b2 | qwen3.6 + Pi | 12.9 分 | ✅ A1 confirmed | ❌「Displayed as NT$10,000 = price_cents ÷ 10 ✓」 | |
| c1 | qwen3.6 + harness | 18.9 分 | ✅ B1 confirmed | ❌ 沒查 DB(只讀 seed.sql 前 5 行拿帳密) | plan 列了「比對 DB」那一點但沒勾,自我檢查判成功 |
| c2 | qwen3.6 + harness | 90 分超時 | ❌ A1 holding | ❌ 沒查 DB | plan 直接把畫面的 NT$10,000 寫成「資料庫價格」 |
| b38-1 | qwen3.8 + Pi | 90 分超時 | ❌ A1 holding | — | 開工前就在 plan 算對期望值(100000 → NT$1,000.00),但沒走完 |
| b38-L1 | qwen3.8 + Pi(240 分) | 約 71 分手動停 | — | — | 每次呼叫 9–13 分鐘,還在探索 |
| bL-1 | Laguna + Pi | 25.2 分 | ✅ A1 confirmed | ❌ 拿保留頁和票券頁(兩邊都錯)互比,判相符 | 工作檔沒寫進 `/work`,只留最後回覆 |
| bL-2 | Laguna + Pi | 18.5 分 | ✅ A1 confirmed | ❌「NT$10,000 (matches database record of 100000 cents = $1,000)」 | 同上 |
| cL-1 | Laguna + harness | 90 分超時 | ❌ 沒有保留 | ❌ | 8 步 |
| cL-2 | Laguna + harness | 90 分超時 | ❌ 沒有保留 | ❌ | 3 步 |

每一輪的 `exit.txt`(結束碼與秒數)、`db-final.txt`(跑完時本機 D1 的保留與訂單)、`pi.log` 或 `outputs/` 都在 `out/<run>/`。

## Claude 留下的腳本重跑(`out/rerun-a-scripts/`,10/10,突變版)

- a2:log 寫「一致=False」,**exit 0**
- a1:第一次 exit 1 —— 腳本把座位寫死成 A1,而 A1 已被前一輪訂走(跟金額無關);重灌 DB 後重跑,log 寫「MISMATCH」「UI==DB: False」,**exit 0**

兩支都會查資料庫、會把不一致寫進 log,但沒有 assert、raise 或非零結束碼 —— 重跑照樣綠。

## 合起來看(exp-06 + 06b,突變版上從頭走查 16 次)

| | 沒寫驗收條件 | 寫了驗收條件 |
|---|---|---|
| Claude + Webwright plugin | 做完 2/2、抓到 0/2 | 做完 3/3、抓到 3/3 |
| qwen3.6 + Webwright harness | 做完 0/1 | 做完 1/2、抓到 0/2 |
| qwen3.6 + Pi | 做完 1/1、抓到 0/1 | 做完 2/2、抓到 0/2 |
| qwen3.8 + Pi | — | 做完 0/1 |
| Laguna + Webwright harness | — | 做完 0/2 |
| Laguna + Pi | — | 做完 2/2、抓到 0/2 |

不是模型評比:每格只跑一到兩次,執行方式不同。能說的是:同一句驗收條件,Claude 拿去查、去比,比出了不一致;地端模型不是沒去查,就是查到了也比不出來。而抓到的那幾次,留下的腳本重跑也不會紅 —— 期望值要寫死在測試裡(`../exp-06-webwright/e2e/`)。
