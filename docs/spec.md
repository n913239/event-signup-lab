# 規格:活動報名系統

> 這份講**要做什麼**。刻意不含實驗設計與陷阱清單 ——
> 那些放在 repo 外(`iThome/2026-impl-spec.md` 第三節),
> 因為無菌室 session 會讀到這個 repo。

## 一句話

活動報名。限量名額、可選位、保留十分鐘、逾時自動釋放、確認後出票。不收錢。

## API

### 認證
| Method | Path | 說明 |
|---|---|---|
| `POST` | `/auth/register` | 建立成員(單一組織) |
| `POST` | `/auth/login` | access token(短)+ refresh token(長) |
| `POST` | `/auth/refresh` | 輪替,舊 refresh 立刻失效 |
| `POST` | `/auth/logout` | 撤銷當前 refresh |

### 活動
| Method | Path | 授權 | 說明 |
|---|---|---|---|
| `POST` | `/events` | staff | 名稱、開賣時間、截止時間、座位配置 |
| `GET` | `/events` | 成員 | 列表,可 `?status=on_sale` |
| `GET` | `/events/:id` | 成員 | 含票種、剩餘名額、座位狀態 |
| `PATCH` | `/events/:id` | 僅主辦 | 改名額 / 時間 |
| `POST` | `/events/:id/close` | 僅主辦 | 手動提前截止 |

### 票種
| Method | Path | 授權 | 說明 |
|---|---|---|---|
| `POST` | `/events/:id/ticket-types` | 僅主辦 | 名稱、價格、名額、早鳥條件 |
| `PATCH` | `/ticket-types/:id` | 僅主辦 | 改價格 |

### 保留與確認
| Method | Path | 授權 | 說明 |
|---|---|---|---|
| `POST` | `/events/:id/holds` | 成員 | 選位 + 保留(預設 10 分鐘) |
| `DELETE` | `/holds/:id` | 僅本人 | 主動放棄 |
| `POST` | `/holds/:id/confirm` | 僅本人 | 確認 → 建訂單 |

### 訂單
| Method | Path | 授權 | 說明 |
|---|---|---|---|
| `GET` | `/orders` | 成員 | 我的票券 |
| `GET` | `/orders/:id` | 本人或主辦 | 明細,含金額快照 |
| `POST` | `/orders/:id/cancel` | 僅本人 | 取消 |

合計 17 條。

## 狀態機

```
活動:  draft → on_sale → closed → finished
                  │          │
                  └─ cancelled ─┘

訂單:  holding → confirmed → checked_in
          │           │
          ├─ expired  └─ cancelled
          └─ cancelled
```

## 必須被測試證明的規則

| 規則 | 測試 |
|---|---|
| `on_sale` 之外不能建 hold | 對 `closed` 活動 `POST /holds` → 4xx |
| 過了 `deadline_at` 即使 `status` 仍是 `on_sale` 也不能報名 | 只推時間不改狀態 → 4xx |
| 未到 `opens_at` 不能報名 | 時間推到開賣前 → 4xx |
| `expired` 的 hold 不能 confirm | TTL 過期後 confirm → 4xx,且座位已釋放 |
| 確認後金額不可變 | 改票價 → 重讀訂單 → 金額不變 |
| 只有主辦能改活動 / 截止 / 改價 | 非主辦 → 403 |
| `cancelled` 是終態 | 從 `cancelled` 轉任何狀態 → 4xx |
| 不超賣 | 併發 N 次,售出數 ≤ 名額,且總數對得起來 |
| 座位不重複 | 併發搶同一座位,只有一個成功 |

> ⚠️ 第二、三條最容易漏:`status` 與 `opens_at`/`deadline_at` 是**兩個真相來源**,
> 兩個都要檢查,而且**每個邊界的測試分開寫**。

## 硬性約束

1. 金額用整數最小單位;顯示轉換只在 `src/presentation/`
2. `src/domain/` 的時間一律從參數進來
3. 併發判斷寫在 SQL 的 `WHERE` 裡,不在應用層
4. 簽章比對用 `crypto.subtle.verify`
5. 訂單明細存價格快照

## 不做

見 `docs/non-goals.md`,15 條。
