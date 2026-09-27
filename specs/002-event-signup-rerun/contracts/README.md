# Contracts

**唯一契約:repo 根目錄 [`openapi.yaml`](../../../openapi.yaml)**(OpenAPI 3.1.0,info.version 0.1.0)。
本目錄**刻意不放副本** —— 使用者要求三端共用一份;多一份就多一個會分岔的地方。

## 誰消費它

| 端 | 方式 | 驗證 |
|---|---|---|
| API(Workers + Hono) | 手寫 handler,回應形狀對齊契約 | `tests/contract.test.js`:每條 operation 打一次,ajv 2020 驗 status 與 body |
| iOS(SwiftUI) | swift-openapi-generator build plugin 產 client | `swift build`;⚠️ 讀的是副本 `ios/EventSignup/Sources/EventSignup/openapi.yaml`,由 `scripts/sync-openapi.sh` 複製 |
| web(Vite) | `web/src/api.js` 手寫呼叫 | ⚠️ 沒有契約測試 |

## 慣例(契約 `info.description`)

- 金額一律整數「分」(`Cents`,`*_cents`);時間一律 epoch 毫秒整數(`EpochMs`,int64)。
- 每個 JSON 回應帶 `x-server-now` header;前端倒數以伺服器時間為準。
- 錯誤一律 `{ error, server_now }`;狀態碼:400 輸入、401 身分、403 權限、404 不存在或不屬於你、409 規則擋下。

## 操作(18 條業務 + 1 條探針)

| # | Method | Path | 授權 | spec |
|---|---|---|---|---|
| 1 | POST | `/auth/register` | — | US2 |
| 2 | POST | `/auth/login` | — | US2 |
| 3 | POST | `/auth/refresh` | — | US2 |
| 4 | POST | `/auth/logout` | — | US2 |
| 5 | POST | `/events` | staff | US3 |
| 6 | GET | `/events` | 成員 | FR-024 |
| 7 | GET | `/events/{id}` | 成員 | FR-025 |
| 8 | PATCH | `/events/{id}` | 主辦 | FR-026 |
| 9 | POST | `/events/{id}/close` | 主辦 | FR-028 |
| 10 | POST | `/events/{id}/ticket-types` | 主辦 | FR-030 |
| 11 | PATCH | `/ticket-types/{id}` | 主辦 | FR-031 |
| 12 | POST | `/events/{id}/holds` | 成員 | US1 |
| 13 | DELETE | `/holds/{id}` | 本人 | FR-050 |
| 14 | POST | `/holds/{id}/confirm` | 本人 | FR-060–062 |
| 15 | POST | `/holds/{id}/quote` | 本人 | FR-066 |
| 16 | GET | `/orders` | 成員 | FR-071 |
| 17 | GET | `/orders/{id}` | 本人或主辦 | FR-070 |
| 18 | POST | `/orders/{id}/cancel` | 本人 | FR-065 |
| — | GET | `/health` | — | ⚠️ 不在原文 18 條(plan C-1) |

## 錯誤代碼(`components.schemas.Error.error` enum)

與 spec FR-090 一致,另有兩個 spec 沒列的:

| 代碼 | 狀態 | 備註 |
|---|---|---|
| `invalid_input` | 400 | |
| `unauthorized` | 401 | |
| `refresh_replayed` | 401 | |
| `forbidden` | 403 | |
| `not_found` | 404 | |
| `email_taken` … `promo_rejected`(10 個) | 409 | 見 spec FR-090 |
| `internal` | 500 | `app.onError` 回傳;沒有列在任何 operation 的 responses |
| `not_implemented` | (501) | 骨架期遺留;`src/` 沒有任何地方回傳 |

## 已知契約落差

- `POST /events/{id}/holds` 的 `seat_nos` `maxItems: 100`(`openapi.yaml:296`),spec 與程式是 10(plan C-3)。
- `Seat.state` enum `free/held/sold/mine`,`mine` 的語意與 spec Q26 不同(plan D-2)。
