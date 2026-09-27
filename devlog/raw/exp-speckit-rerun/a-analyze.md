## 規格分析報告:`specs/001-event-signup-full`

`.specify/extensions.yml` 不存在,所以前後都沒有 hook 要跑。

整體看下來,2026-09-27 那次改定已經回寫到 spec 的 FR 和 SC,也回寫到 quickstart。改定內容有三塊:折扣改成擇優、H1/H4/H7/M1/M2 幾條保留與確認規則、試算 endpoint 和登入鎖定。但 **spec 的 US1 驗收情境、Edge Cases、plan 摘要、tasks 的舊描述和 constitution 都還停在舊規則**。問題大多是文件之間互相矛盾,程式碼本身沒事:我抽查了 H1 一次最多 10 席(`validate.js:72`)和 H4 名額歸還(`holds.js`、`orders.js`),兩條都已經實作。

| ID | 類別 | 嚴重度 | 位置 | 摘要 | 建議 |
|---|---|---|---|---|---|
| D1 | Constitution | CRITICAL | constitution §I;plan:57;tasks T041/T046/T049b | 規則 I 寫的是「分 → 元只能在 `src/presentation/`」,但 `web/src/lib/money.js` 和 iOS 的 `Tickets/Money.swift` 也在做這個換算。Swift 那支完全沒有裁判,違反「沒有裁判的規則等於沒有規則」 | 先改 CLAUDE.md 規則 I,把三個允許做換算的位置列清楚,再跑 `/speckit-constitution` 同步。Swift 那支要嘛補一支裁判,要嘛正式記在 `verified.md` 的 ❌ 欄 |
| D2 | Constitution | HIGH | constitution:48、CLAUDE.md:35 vs docs/spec.md:64 | constitution 和 CLAUDE.md 還寫 17 條 endpoint,原文 `docs/spec.md` 已經是 18 條。照 Governance 的規定,constitution 已經過期 | 改 CLAUDE.md 後重跑 `/speckit-constitution`,可以跟 T057 一起做 |
| I1 | Inconsistency | HIGH | spec.md:216 vs spec.md:249 | **FR-038 這個編號用了兩次**:一條是 quote 試算,一條是座位保護涵蓋 holding/confirmed,追溯時會分不清 | 試算那條改用新編號(例如 FR-039a,或接在 FR-038 後的空號) |
| I2 | Inconsistency | HIGH | spec.md:74–76(US1 情境 5、6) | 驗收情境還是「早鳥 % → 團體 % → 減優惠碼」的疊加算法,跟 FR-052/053 的擇優規則衝突 | 按擇優規則重寫,用 SC-003 的 90000 範例 |
| I3 | Inconsistency | HIGH | spec.md:77(US1 情境 7)、spec.md:200(Edge Case) | 還寫著「優惠碼無效 → 4xx,不靜默忽略」,跟 FR-056/SC-011 的「別的折扣一樣好或更好時忽略碼」衝突 | 兩處都改成 FR-056 的條件式 409 |
| I4 | Inconsistency | HIGH | tasks T037 vs spec FR-007、US3 情境 8、SC-009、C18;tasks T056 | T037 已經結案,理由是「外部清單不再需要」,但 spec 仍然要求「JWT 七項邊界由外部清單裁定」。T056 也還寫「外部清單若沒跑就留著」 | 請作者決定:要嘛 spec 改成「repo 內 6 個測試 + check-jwt-timing」,要嘛 T037 重新打開 |
| I5 | Inconsistency | HIGH | tasks T051(未完成) | smoke 的斷言還是 `total_cents = 314000`(疊加算法),quickstart 已經改成 360000 | T051 斷言改成 360000,另外斷言 `promo_code = null`(WELCOME 沒被用掉) |
| I6 | Inconsistency | MEDIUM | tasks T033 vs FR-022(M1) | confirm 流程寫「確認時做 `isEarlyBird`」,M1 已經改成看**建 hold 的時間** | 更新描述,或註記「由 T073 取代」 |
| I7 | Inconsistency | MEDIUM | tasks T032 vs FR-043(H7) | 寫的是「`changes = 0` → 409 `hold_expired`」,H7 要求重複確認時回同一張訂單 | 同上 |
| I8 | Inconsistency | MEDIUM | tasks T030、T050 vs FR-030(H4) | sweep 寫成「一句 UPDATE」,cancel 的 batch 也沒有還名額。程式碼其實有還(`holds.js:52,64`、`orders.js:63`),只是描述過時 | 描述補上歸還名額,或註記「由 T073 取代」 |
| I9 | Inconsistency | MEDIUM | tasks T015 vs FR-043 | 狀態表還是 hold 和訂單合在一台狀態機(`holding→confirmed→checked_in`),FR-043 已經拆成兩台 | 更新 T015 描述 |
| I10 | Inconsistency | MEDIUM | tasks T014 vs FR-030(H1) | `seat_nos ≤ 100`,H1 是 ≤ 10(程式碼已經是 10) | 改描述 |
| I11 | Inconsistency | MEDIUM | tasks T043 vs FR-081 | 「409 顯示原始 error 字串(刻意的)」,FR-081 已經改定成 web 端翻成中文 | 改描述 |
| I12 | Inconsistency | MEDIUM | plan:13、plan:118、plan:196–205 | 摘要還寫「先乘後減」;contracts 那行還寫「17 條 + /health」;實作順序表的步驟 2、4、5 還標「作者」,但 T007、T011、T020 已經改成寫作 session 寫、作者審 | 同步 plan |
| I13 | Inconsistency | MEDIUM | constitution §V 註記、CLAUDE.md vs plan:90 | 註記還說規則 V 的另一半「還沒有自動檢查」,其實 `schema.test.js` ⑥ 已經在裁 | 做 T057(還沒完成) |
| I14 | Inconsistency | LOW | tasks T018、T022(c) | T018 的 71000 向量和「哪個贏由 T030 決定」都已經被 SC-003(90000)和 SC-004(原持有人一律輸)取代 | 加上「已被 T072 / SC-004 取代」的註記 |
| C1 | Underspec | MEDIUM | spec FR-013、US2 | 「改活動名額」講不清楚:活動固定 100 席,名額其實在票種上。實作是 `PATCH /events` 帶 ticket_types 的 capacity,但 FR-021 又說票種 PATCH 只能改價 | FR-013 寫明「透過 PATCH /events 改各票種名額」 |
| C2 | Underspec | LOW | plan:82 vs FR-046、US4 情境 6、T040 | plan 說 QR「只簽不驗」,spec 卻說「查驗端用同一把 key 驗」,T040 的測試用的是「重算後比對」。在 `tests/` 裡沒問題,因為 check-jwt-timing 只掃 `src`,但跟規則 IV 的精神有張力 | spec 註明查驗端不在範圍內(非目標 13);測試改用 `subtle.verify` |
| A1 | Ambiguity | LOW | US1 情境 18、US4 情境 3、US5 情境 3 | 只寫「被拒」沒寫狀態碼;實作一律回 404 | spec 標明是 404(不透露資源存在) |
| E1 | Coverage | LOW | FR-008(L1) | 有任務(T075),但沒有對應的 SC | 視需要補一條 SC |

**覆蓋率摘要**(只列有問題或有備註的;其餘 FR 都有對應任務)

| 需求 | 有任務? | 任務 | 備註 |
|---|---|---|---|
| FR-007 / SC-009 七項邊界 | ⚠️ | T011、T011b、T037(已結案) | 見 I4 |
| FR-008 L1 | ✅ | T075 | 沒有 SC |
| FR-038(quote) | ✅ | T074 | 編號重複,見 I1 |
| FR-052/053/056 擇優 | ✅ | T072、T073 | 原始任務描述過時 |
| SC-007、SC-008 | ⏳ | T055(未完成) | |
| SC-001/002 真實併發 | ⏳ | T053(未完成) | |
| smoke 端到端 | ⏳ | T051(未完成) | 斷言錯誤,見 I5 |

**Constitution 對齊問題**:D1(規則 I 的範圍)和 D2(constitution 過期)。

**沒有對應需求的任務**:沒有。T056–T060 屬於 Polish 和文章素材,對應的是 constitution 的做完定義。

**數據**

| 項目 | 數值 |
|---|---|
| 需求 | 63 條(FR 52 + SC 11) |
| 任務 | 63 個(已完成 56) |
| 覆蓋率 | 100%(有 ≥ 1 個任務) |
| 模糊項 | 2(A1、C1) |
| 重複 | 1(I1) |
| CRITICAL | 1 |

### 下一步

- **D1 要在繼續實作之前解決。** 這要改原文 CLAUDE.md 的規則 I,屬於作者層級的決定,不能直接改 constitution。
- **I4 也要作者決定**:JWT 的外部清單還要不要算驗收。
- 下一個會跑的任務是 T051,跑之前要先修 I5,不然 smoke 一定會紅。
- I2、I3、I1 手動改 spec 就行;不想重新產生整份 spec,就不必跑 `/speckit-specify`。
- I6 到 I14 可以集中在一個「同步 tasks/plan 描述」的 commit 裡處理。

要不要我針對前 8 項(D1、D2、I1–I5、I12)列出具體的修改內容?我不會自動套用。