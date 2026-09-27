# spec-kit 重跑:規格改了之後(2026-09-27)

9/14 用 spec-kit v1.0.6 規劃(`bca4d9a`);9/27 作者改了多條規則(擇優、試算 endpoint、登入鎖定、16 條保留規則)。
重跑前的狀態打了 tag `speckit-baseline-0927`。`claude -p`,claude-opus-5-5。

| 輪 | 做了什麼 | cost / turns | 結果 |
|---|---|---|---|
| (b) analyze | **不回寫**,直接跑 | $0.935 / 12 | 自己發現 spec-kit 產物落後 `docs/spec.md`:擇優(CRITICAL,71000 在現行規則下不成立)、第 18 條 quote、L1、16 條規則;**另外抓到 logout 沒有任何測試,T036 卻已打勾**(真的漏洞,已補 T035) |
| (b) converge | 同上,在 worktree 跑,只追加 task | $1.180 / 18 | 追加 T061–T071;抓到 logout 不帶 body 回 204(契約是 required → 已改 400)、web 錯誤訊息翻中文與非目標衝突、iOS 活動列表沒離線快取 |
| (a) 回寫 | 寫作 session 把改定寫進 spec / plan / quickstart / data-model / tasks(`c6581f6`) | — | — |
| (a) analyze | 回寫後再跑 | $0.774 / 9 | **回寫不完整**:US1 驗收情境、Edge Case 還是疊加;**FR-038 編號重複**(回寫造成);tasks 舊描述過時;constitution 規則 I 說分 → 元只准在 presentation,但 web 與 iOS 也在做,**Swift 那支沒有裁判** |
| (a) converge | 回寫後再跑(worktree) | $1.208 / 18 | 追加 T077–T081:SC-004 沒斷言「原持有人輸」、**sweep 與 Cron 沒有測試**、**同一 hold 兩個 confirm 同時到時輸的一方回 409(H7 要回同一張)**、**PATCH /events 不是全有全無**、race.sh payload 跟契約不符 |
| (a) 補漏洞 | 寫作 session 照 analyze 的 D1–I14、C1、C2、A1、E1 改(`7d4963e`);Money.swift 補裁判(`0492e65`);T080/T081 修好(`06f8fd2`) | — | — |
| (a) constitution | `/speckit-constitution` 同步原文 | $0.508 / 13 | 1.0.0 → **2.0.0**(它照本文件的規則判 MAJOR:規則 I 允許位置一處改三處算改寫);刪掉已解決的「規則 V 另一半應有到期條件」 |

原始輸出:`b-*.md` / `a-*.md`(報告)、`*.json`(cost 與 usage,session id 已遮)、`*-converge-tasks.diff`(converge 追加的 task,沒進主線)。

## 整套重跑 → specs/002(2026-09-27)

在 `ec550fa` 開的 detached worktree 裡跑,**先刪掉 `specs/001-event-signup-full/` 與本資料夾**,避免它照抄上一版;constitution 用已同步的 2.0.0。
同一個 session 四輪(specify → clarify → plan → tasks),prompt 逐字存在 `002/*.prompt`。它把新 spec 寫進 `001-event-signup-full`(資料夾已刪,腳本照舊命名),搬回主線時改名成 `specs/002-event-signup-rerun/`,檔案內文沒改。

| 步 | cost / turns | 結果 | 對照 9/14(001) |
|---|---|---|---|
| specify | $1.617 / 20 | 42 個 [NEEDS CLARIFICATION];**抓到 docs/spec.md 優惠碼平手兩句互相矛盾** | 21 個。⚠️ 這次 prompt 多一句「數量上限不必管」,9/14 沒有 —— 標記數不能直接比 |
| clarify | $4.609 / 8 | 標記清零;逐條對程式碼,**抓到寫作 session 給的答案有兩條跟現況不符**(Q11 免費票種帶無效碼、Q26 `mine` 含自己已確認的座位);另抓到契約 `seat_nos maxItems: 100`(已修,`39c800e`)、iOS 千分位跟裝置語系走 | $1.156 |
| plan | $6.412 / 27 | 五條 gate 全過、6 個 ⚠️(G3-b:PATCH 名額是先查再寫,trigger 是第二道);指出 `/health` 是第 19 條、web 沒契約測試、兩份 openapi.yaml 沒有檢查同步 | $2.702 |
| tasks | $7.499 / 7 | 88 個 task、46 個照 git log 打勾;**時間軸照實寫:9/17–9/26 零 commit,9/27 一天做完 18 條**;剩下 42 個多半是「行為有、沒有測試釘住」 | 60 個 / $1.276 |

合計 **$20.14**(9/14 是 $6.78)。貴在 plan / tasks 要讀整個已實作的 repo。
