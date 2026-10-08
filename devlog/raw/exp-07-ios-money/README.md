# 實驗 07:iOS 金額顯示,AI 會不會跟著裝置語系走(Day 28)

- 日期:2026-10-08;模型:claude-opus-5-5(`claude -p`,版本見 `claude-version.txt`)
- 無菌室:repo 外空目錄,每次一個;只給 prompt,不給 repo、規格、測試或共用向量
- 權限:`--permission-mode acceptEdits --allowedTools Read,Edit,Write` —— **沒給 Bash**,六次都在回覆裡照實說了「還沒編譯過」
- 兩組 prompt(逐字見 `A/prompt.md`、`B/prompt.md`),各跑 3 次:
  - **A 規則完整**:介面、前綴 `NT$`、千分位、整數元不顯示小數、負號在最前面、四個例子、金額路徑不准用浮點數
  - **B 只給一個例子**:介面,加一句「轉成像 `NT$4,444.20` 這樣的字串」
- 對照:寫作 session 的 iOS 第一版 `Tickets/Money.swift`(commit `c7cfe38`,用 `NumberFormatter` 做千分位),與現行版(commit `3a5dc5a` 起,自己拆千分位)
- 量測:`harness/main.swift` 讀 web 與 iOS 共用的 14 組向量(`tests/fixtures/money-format.json`),逐組比 `Money.format` 的輸出;
  同一支程式跑兩次,一次用本機語系(zh_TW),一次加 `-AppleLocale de_DE` → `measure.out`

## 結果

| | `c7cfe38`(寫作 session) | A × 3(規則完整) | B × 3(只給一個例子) |
|---|---|---|---|
| 用 `NumberFormatter` / `.formatted(.number)` | **是** | 0 / 3 | 0 / 3 |
| 共用向量,zh_TW | **14/14** | 14/14 | 9/14 |
| 共用向量,de_DE | **9/14**(`NT$9.999.99`) | 14/14 | 9/14 |
| 輪 / 花費 / 時間 | — | 5–8 / $0.19–0.22 / 19–28 秒 | 5–7 / $0.19–0.21 / 19–25 秒 |

1. **無菌室六次都沒有跟著語系走。** 六次都自己拆千分位,回覆裡都主動說明「不依賴 `NumberFormatter` / 裝置地區設定」——連 B 這種沒提任何格式規則的 prompt 也一樣。
2. **踩到的是寫作 session 那一版,而它在開發機上是綠的。** `c7cfe38` 在 zh_TW 下 14/14 全過,換成 de_DE 才紅 5 組。共用向量的測試在開發機的語系下抓不到這個錯;當時抓到它的是 spec-kit 重跑 `clarify`(讀程式),不是測試。
3. **B 三次都自己決定「一律顯示兩位小數」**,紅的 5 組全是整數元(`NT$1,000.00` 對 `NT$1,000`)。B1 在回覆裡寫了「如果整數金額想省略 `.00`,跟我說一聲」——規則沒寫的地方,它先替你選一個答案。

## 因此補的檢查

`scripts/check-money.sh` 加一條:iOS 原始碼(含 `Tickets/Money.swift`)出現 `NumberFormatter`、`.formatted(.currency|.number)`、`.currency(code:` 就紅;日期的 `.formatted(date:…)` 不擋。
`scripts/self-test.sh` 補兩個抓得到、一個不誤報的探針。把 `c7cfe38` 的 `Money.swift` 放回去,`check-money.sh` 紅在第 9 行。

## 附註

- A 第 2 次與 B 第 2 次都用 Write 在專案目錄外寫了 `/tmp/money_check/main.swift`(想編譯驗證,但 Bash 被擋)。A 是三次平行跑的,A 第 3 次的回覆提到看到這個檔、沒去動它;B 改成依序跑,每次之前清掉 `/tmp/money_check`。
- `run.json` 已拿掉 session_id,本機路徑換成 `./`。
