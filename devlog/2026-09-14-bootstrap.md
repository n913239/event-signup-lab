# 2026-09-14(提前於 9/10 做)—— 骨架

## 今天叫 AI 做什麼

「照 `docs/spec.md` 的 17 條 endpoint 接出 Hono 骨架,全部回 501,**零 SQL**。」

零 SQL 是硬條件,不是風格偏好:`schema.sql` 是 Day 22 的實驗對象,
骨架先把資料表寫死就毀了那個實驗(見 `docs/EXPERIMENT-PROTOCOL.md`)。

## 交出什麼

```
src/worker.js            fetch + scheduled(空殼,等 sweepExpired)
src/app.js               Hono、server_now middleware、onError、notFound
src/routes/_stub.js      501 佔位
src/routes/{auth,events,ticket-types,holds,orders}.js   17 條
tests/helpers/db.js      getPlatformProxy + 切 ; 載入 schema(schema 還沒有時跳過)
tests/app.test.js        /health、x-server-now、404、17 條各自 501
```

## 驗收(當場跑的)

```
npx vitest run                          24 passed
npm run check:all                       五道全綠
sh scripts/self-test.sh                 40 筆探針全過
grep -rc 'prepare(' src/                0      ← 零 SQL
grep -riEc 'UPDATE |INSERT |SELECT '    0
```

## 兩個決定

**一、`server_now` 放在 middleware,不是每個 handler 自己取。**
`c.set('now', Date.now())` 只有這一個地方呼叫 `Date.now()`(另一處是 `scheduled`)。
硬規則 2 說「`src/domain/` 的時間一律從參數進來」——
取現在時間是 routes 的責任,而把它集中在一個 middleware,
之後測試要凍結時間只要換這一行。

**二、17 條的測試現在證明的是「路由接對了」,不是「功能做好了」。**
每接好一條就把它從 `app.test.js` 搬到自己的測試檔 ——
那個清單會愈來愈短,而它歸零的那天就是 9/21 的里程碑。

## 還沒做的

- `openapi.yaml`:契約要**先於**任何回 200 的 handler commit(Day 23 的證據)
- `schema.sql`:作者手寫,commit message 明寫「AI 尚未介入」
- `wrangler login` / `d1 create signup` / 換掉 `database_id` / 首次 deploy
