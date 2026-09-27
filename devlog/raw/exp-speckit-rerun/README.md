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

原始輸出:`b-*.md` / `a-*.md`(報告)、`*.json`(cost 與 usage,session id 已遮)、`*-converge-tasks.diff`(converge 追加的 task,沒進主線)。
