# 活動報名系統 Constitution

活動報名系統。對外叫報名,對內跑的是**售票的規則**:
限量名額、搶、狀態機、逾時釋放。差別只在收不收錢,而我們不收錢(非目標 3)。

本文件的正文**照抄**自 `CLAUDE.md`、`docs/non-goals.md`、`docs/spec.md`,不新增原則。
與原文衝突時以原文為準(見 Governance)。

## Core Principles

以下五條是硬規則。**違反 = CI 紅燈,不是風格問題。**

### I. 金額一律用整數最小單位

金額路徑出現浮點 = CI 紅燈。
顯示轉換(分 → 元)只能在 `src/presentation/`。

裁判:`scripts/check-money.sh`

### II. 時間是參數,不是副作用

`src/domain/` 不准出現 `Date.now()` / `new Date()`;`now` 從外面傳進來。
取現在時間是 `routes` / `worker` 的責任。

裁判:`scripts/check-time-injection.sh`

### III. 併發判斷必須在 SQL 的 `WHERE` 裡

不能在應用層先查再寫。條件式寫入 + 檢查 `changes`,並用 `CHECK` 當第二道防線。

裁判:`scripts/check-concurrency.sh`

### IV. 簽章比對必須是常數時間

不得自己重算 HMAC 再 `===`。

裁判:`scripts/check-jwt-timing.sh`

### V. 確認後的訂單金額不可變

明細要存價格快照,不是 JOIN 即時算。

裁判:`scripts/check-price-snapshot.sh` —— **只管到一半**,見下。

> ⚠️ **規則 V 只有一半有裁判。** `check-price-snapshot.sh` 管的是
> 「**沒有任何 `UPDATE` 可以寫入金額欄**」—— 金額只在建單那次 `INSERT` 寫進去。
> 另一半「明細要存快照,不是靠 `ticket_type_id` JOIN 即時算」**還沒有自動檢查**:
> 那要知道票種表與價格欄叫什麼,而 `docs/spec.md` 目前只定義 17 條 endpoint,
> 沒定義 schema。`schema.sql` 落地之後補;在那之前那一半由 `/check-schema` 第 6 條
> 人工把關,狀態記在 `docs/verified.md`。

### 裁判總表

每一條都要有裁判 —— 沒有裁判的規則等於沒有規則:

| 規則 | 裁判 |
|---|---|
| I 金額整數 | `scripts/check-money.sh` |
| II 時間當參數 | `scripts/check-time-injection.sh` |
| III 併發寫進 `WHERE` | `scripts/check-concurrency.sh` |
| IV 常數時間比對 | `scripts/check-jwt-timing.sh` |
| V 價格快照 | `scripts/check-price-snapshot.sh` —— **只管到一半** |

`scripts/self-test.sh` 負責證明上面每一支都真的抓得到 ——
一支從不亮紅燈的檢查,跟沒有檢查是同一件事。

## 非目標(不可協商的邊界)

> **這份清單比功能清單更重要。** AI 最擅長的就是擴張範圍。
> 你叫它做報名系統,它會順手加通知、加候補、加評價、加統計圖表。
> 非目標清單是唯一擋得住它的東西。

下列 15 條 SHALL NOT 做。**不要主動加表、加欄位、加 endpoint。** 你認為缺的東西,先問。

| # | 不做 | 為什麼 |
|---|---|---|
| 1 | 上架 App Store / TestFlight | 無付費開發者帳號;學習用 |
| 2 | APNs 推播 | 同上。改用清單 + 拉取 |
| 3 | **線上金流 / 實際付款** | **只記帳,不收錢**。範圍與合規都爆炸 |
| 4 | 真實場館座位圖 | 只做 10×10 方格,不畫舞台、不做不規則排列 |
| 5 | 多租戶(多組織) | 只做單一組織 |
| 6 | 即時聊天 / WebSocket | — |
| 7 | Android | — |
| 8 | 離線編輯 / 衝突合併 | 只做離線讀取快取,寫入一律要連線 |
| 9 | 圖片上傳(R2) | 活動海報用文字 + 純色 |
| 10 | 國際化(i18n) | 只做繁中 |
| 11 | 管理後台 | 用 `wrangler d1 execute` 直接下 SQL |
| 12 | SSO / OAuth 第三方登入 | 自製 JWT 就是題目本身 |
| 13 | 驗票掃碼入場 | 票券顯示 QR,不做掃描端與核銷 |
| 14 | 效能優化 | 除非免費額度真的爆(那才是素材) |
| 15 | UI 精緻度 / 完整 a11y | 系統元件 + Dynamic Type 不炸掉即可 |

「刻意保留的醜」與「不做的架構」兩節見 `docs/non-goals.md`,本文件不重抄。

## 每個 Feature 的「做完」定義

**「使用者可以報名」沒有裁判資格** —— 什麼叫可以?跟到一半失敗算不算?
截止後還能跟算不算?所以每一條都要寫成能判定的句子:

| Feature | 做完 = |
|---|---|
| 活動與票種 | 只有主辦能改名額與時間;測試證明越權被拒 |
| **報名 / 選位 / 保留 / 確認** ⭐ | **併發測試通過(不超賣、不重座),且金額路徑零 `Double`,且保留逾時的三方競態有明確且被測試釘住的行為** |
| 我的票券與歷史 | web 與 iOS 對同一個 GET 顯示同一份資料,且 D1 讀取次數有算過 |

⭐ 那一列是整個專案的重心:一句話裡三個條件,而**沒有一個能靠讀 code 檢查**。

## Governance

**來源與優先順序。** 本文件是 `CLAUDE.md`(硬規則)、`docs/non-goals.md`(非目標)、
`docs/spec.md`(做完定義)三份原文的抄本。三份原文 SHALL 保持為唯一真相來源;
本文件與原文不一致時,以原文為準,並視為本文件過期。

**判準(照抄自 `docs/non-goals.md`)。**

> 每一個中介軟體都必須為一條「測試能裁決的規則」而存在。
> 為了展示而加的東西在這裡是負分 —— 因為它沒有裁判。

**修訂程序。** 要改原則,MUST 先改原文(`CLAUDE.md` / `docs/non-goals.md` / `docs/spec.md`),
再重跑 `/speckit-constitution` 同步回本文件;不得反向 —— 只改本文件而原文不動。
新增硬規則 MUST 同時附上裁判腳本並納入 `scripts/self-test.sh`,否則等於沒有規則。

**版本規則(Spec Kit 模板要求,原文沒有)。** 依 semver:
MAJOR = 移除或改寫既有原則 / 非目標 / 做完定義;MINOR = 新增一條;PATCH = 措辭與錯字。

**Version**: 1.0.0 | **Ratified**: 2026-09-14 | **Last Amended**: 2026-09-14

---

## 建議新增(未採納)

依指示,以下是我覺得值得加、但原文沒有的東西。**都沒有寫進正文**,要不要採納由你決定;
採納的話先改原文再同步。

### 原文有、但你只指定了五條硬規則,所以沒抄進正文

- `CLAUDE.md`「寫測試」三條:先寫會紅的測試再動手;併發測試一律用 `tests/helpers/gate.js`
  的閘門,不用隨機延遲;**不穩定的重現 = 沒有重現**,併發測試要能重跑 5 次結果一致。
- `CLAUDE.md`「提交」三條:一個變更一個 commit、message 用中文、不加 AI 署名 trailer。
- `docs/spec.md`「必須被測試證明的規則」九條表(狀態機邊界、`status` 與
  `opens_at`/`deadline_at` 是兩個真相來源)—— 這其實是「做完定義」⭐ 那列的展開。

### 原文沒有的

- **硬規則 IV 的兩種說法不一致。** `CLAUDE.md` 寫「常數時間比對」,`docs/spec.md`
  硬性約束第 4 條寫「用 `crypto.subtle.verify`」。前者是要求,後者是實作;建議原文擇一,
  或明寫「後者是前者的唯一允許實作」。
- **規則 V 的另一半應有到期條件。** 目前寫「`schema.sql` 落地之後補」,但沒說誰在
  `schema.sql` 進 repo 的那個 commit 負責補裁判。建議明寫:落地 `schema.sql` 的 commit
  MUST 同時補齊 `check-price-snapshot.sh` 的另一半,否則 CI 紅燈。
- **非目標的例外程序。** 15 條寫了「為什麼」,但沒寫要怎麼推翻其中一條(第 14 條自帶
  例外條件,其餘沒有)。建議加一句:推翻任一非目標 MUST 改 `docs/non-goals.md` 並在
  commit message 寫明理由,不能在功能 commit 裡順手做。
