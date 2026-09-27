# 規格分析報告:`specs/001-event-signup-full`

**結論:** `spec.md` 已經落後。它第 14 行自己寫「以 `docs/spec.md` 為唯一真相來源」,但 `docs/spec.md` 在 2026-09-27 改了好幾條規則,這些改動都沒有回寫到 `spec.md`、`plan.md`、`tasks.md`:折扣改成擇優、C8 改定、新增第 18 條 endpoint(試算)、新增 16 條保留規則,以及登入失敗鎖定(L1)。另外 `tasks.md` 有一個 task 打了勾,但它依賴的測試並不存在。

這次只讀檔,沒有改任何檔案。專案沒有 `.specify/extensions.yml`,所以沒有要跑的 hook。

## 發現的問題

| ID | 類別 | 嚴重度 | 位置 | 問題 | 建議 |
|---|---|---|---|---|---|
| I1 | 不一致 | **CRITICAL** | spec.md C8、C9、FR-051–053、FR-056、US1 AS5–7、SC-003、SC-011、Assumptions「折扣順序」 | spec.md 還寫「疊加、先乘後減、71000 分」。`docs/spec.md` 已改成「只套一種、選最便宜、平手依序 優惠碼 → 早鳥 → 團體」,同一個例子現在是 90000 分。SC-003 寫的「算出 71000 分」在現行規則下做不到,`money.test` 甚至把 71000 列成不能出現的值。C8 也從「一律 4xx」改成「別的折扣一樣好或更好時,忽略這個碼、訂單照樣成立」 | 依 `docs/spec.md`「折扣怎麼算」重寫這幾處,SC-003 換成擇優的測試向量 |
| I2 | 覆蓋缺口 | HIGH | spec.md(沒有這條 FR)、plan.md:12、42、98;tasks.md T050、Phase 7 checkpoint | 第 18 條 `POST /holds/:id/quote`(commit 04666ae)在 spec、plan、tasks 裡都沒有。三份文件都還寫「17 條」,T050 寫「17/17」 | spec 補 FR 與 US1 驗收情境(`promo_status` 四種值);tasks 補一個已完成的 task;全文件把 17 改成 18 |
| I3 | 不一致 | HIGH | spec.md FR-081、Key Entities「成員」;data-model.md | L1 登入鎖定已實作,`schema.sql` 也加了 `failed_logins`、`locked_until` 兩欄。但 FR-081 仍寫「沒有 rate limit,MUST NOT 主動補」,Key Entities 和 data-model 也沒有這兩欄。`non-goals.md` 已經改了 | 改 FR-081,補一條 FR 寫 L1,成員實體補兩欄 |
| I4 | 規格不足 | HIGH | spec.md FR-022、FR-030、FR-037、FR-056、SC-004;tasks.md T014、T022 | 作者 9/27 定的 16 條保留規則大多沒進 spec,且和現有文字衝突:<br>• H1「一次最多 10 席」,但 FR-030 沒寫上限,T014 寫 ≤ 100<br>• M1「早鳥看建立保留的時間」,但 FR-022 只寫 `now`,讀起來像確認當下<br>• M2「取消後可再用碼」,但 FR-056 寫「每人每活動只能一次」<br>• H7「確認兩次回同一張訂單」,spec 沒寫<br>• 三方競態「原持有人一律輸」已定案,但 SC-004 和 T022 還寫「行為待 T030 決定」 | spec 補一節「保留與確認的商業規則」,照抄 `docs/spec.md` 那張表;FR-022、FR-030、FR-056 跟著改 |
| C1 | 覆蓋缺口 | HIGH | tasks.md T035 對照 T036 | T036 打了勾,並寫「T035 綠」,但 T035 沒打勾,`tests/routes/auth.test.js` 也不存在。整個 `tests/` 找不到任何 logout 測試。這違反 CLAUDE.md「先寫一個會紅的測試,再動手」。FR-004、US3 AS6、SC-009 裡跟 logout 有關的部分都沒有測試 | 補 T035 的測試(logout 回 204 後 refresh 回 401、不帶 body 回 400、`expires_at` 過期回 401);在那之前把 T036 改回未完成,或註明「測試缺」 |
| I5 | 不一致 | HIGH | tasks.md T051;quickstart.md:65 | smoke 測試會斷言 `total_cents = 314000`(疊加的算法)。照擇優,小計 400000 分時會是 360000 分(早鳥和團體平手,選早鳥)。照原文做,smoke 會紅,或被「修」成錯的值 | 先改 quickstart.md 第 3 節的預期值,再做 T051 |
| D1 | 憲章 | MEDIUM | constitution.md 規則 V 註記、最後修訂日 9/14 | 註記還寫「另一半還沒有自動檢查」「只定義 17 條 endpoint」,但 `tests/schema.test.js` ⑥ 已經在把關(見 plan.md:90)。依憲章自己的 Governance,它和原文不一致時「視為本文件過期」。這不是違反 MUST 規則,是同步落後 | 做 T057(PATCH 版本);順便確認 CLAUDE.md 那段註記也一起改 |
| I6 | 用詞飄移 | MEDIUM | spec.md FR-043;tasks.md T007、T015 | FR-043 把 hold 的狀態(`holding`、`expired`)和訂單的狀態寫進同一台狀態機;T007 的訂單列舉只有 `confirmed`、`checked_in`、`cancelled` | FR-043 拆成 hold 和訂單兩台狀態機 |
| I7 | 不一致 | MEDIUM | tasks.md T054、T052 | T054(Pages 上線)已經在 commit aa2185e 完成,但還是 `[ ]`;T052 是 `[~]`,沒寫還差什麼 | 更新勾選狀態,T052 註明剩下哪幾步 |
| I8 | 不一致 | LOW | plan.md 專案結構的 iOS 部分 | 只列 `Auth/`、`Tickets/`、`Cache/`,沒有 T049a 的 `Events/`(C2 已改成三個畫面) | 補一行 |
| A1 | 模糊 | LOW | spec.md Assumptions「解讀(C3 + C9)」 | 還寫「請作者確認」,但 `docs/spec.md` 的擇優節已經寫明「一個 hold 一個票種」 | 改成「已確認」 |
| A2 | 未完成 | LOW | tasks.md T037;`tests/jwt.test.js` | 七項邊界的外部清單還沒接上,目前 repo 內只有 6 個 `it`。清單內容本來就放在 repo 外,是刻意的 | 維持記在 `verified.md` 的 ❌ 欄,等 T037 |

## 需求對應 task 的情形

| 需求 | 有 task? | Task | 備註 |
|---|---|---|---|
| FR-001–003、005–007 | ✅ | T010–T013、T017、T036、T011 | |
| FR-004 logout | ⚠️ | T036 | 有實作,**沒有測試**(C1) |
| FR-010–016 | ✅ | T024、T026、T028 | |
| FR-020–023 | ✅ | T025、T027、T029、T020 | FR-022 規則過時(I4) |
| FR-030–039 | ✅ | T022、T023、T030、T033、T034 | FR-030 沒寫 H1 上限(I4) |
| FR-040–046 | ✅ | T038–T040、T050 | FR-043 用詞混在一起(I6) |
| FR-050–056 | ✅ | T018、T033 | **寫的是舊規則**(I1) |
| FR-060–063 | ✅ | T041–T046 | |
| FR-070–072 | ✅ | T047–T049b | |
| FR-073、FR-081 | —(禁止事項) | — | FR-081 已和 L1 衝突(I3) |
| FR-080 | ✅ | T005 | |
| SC-001、002、004 | ✅ | T022、T030 | SC-004 的行為已定案,文字沒跟上 |
| SC-003 | ⚠️ | T018 | 寫的 71000 在現行規則下不成立 |
| SC-005、006 | ✅ | T023–T025 | |
| SC-007、008 | ⏳ | T055 | 還沒做 |
| SC-009 | ⚠️ | T035 ❌、T037 ⏳ | |
| SC-010 | ⏳ | T060 | |
| SC-011 | ⚠️ | T033 | C8 改定後語意變了 |
| *(沒有對應 FR)* quote、L1 | — | 只有 commit | 見 I2、I3 |

**沒對應到需求的 task:** T001–T006、T008、T011b、T019、T021、T031、T056–T059。這些是實驗、流程和收尾的 task,本來就不對應功能需求,不算問題。

## 數字

- 需求:52 條 FR + 11 條 SC = 63 條
- Task:62 個;49 個已完成,1 個部分完成(T052),12 個未完成(其中 T054 其實已經做完)
- 覆蓋率:61/63 條有 task(97%);剩下 2 條是禁止事項,不需要 task。但**有 task 不代表規則是對的**:I1 和 I4 那些條目有 task,只是寫的是舊規則
- 模糊:2 項;重複:0;CRITICAL:1 項

## 下一步

- **I1 屬 CRITICAL,但它是文件落後、不是程式錯。** 程式和測試照的是最新的 `docs/spec.md`。會實際造成傷害的是之後照舊文件做的 task,尤其是 T051 的 314000 和 SC-003 的 71000。
- 建議順序:
  1. 手動把 spec.md 對齊 `docs/spec.md`,處理 I1–I4(用 `/speckit-specify` 重跑會蓋掉 21 條 Clarifications,不建議)
  2. 修 quickstart.md 的預期值,再做 T051
  3. 補 T035 的 logout 測試
  4. 改 `tasks.md` 的 17 → 18 與勾選狀態(I2、I7)
  5. 做 T057,讓憲章跟上

要我針對前 5 項(I1、I2、I3、I4、C1)給具體的修改內容嗎?我會先列出來給你看,不會直接改。