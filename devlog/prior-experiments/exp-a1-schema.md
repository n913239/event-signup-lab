# 部門揪團訂飲料系統 — SQLite Schema

單一群組、單一部門,不做 multi-tenant,所以**沒有** `company_id` / `department_id` 這類欄位。

## 設計前提

| 決策 | 選擇 | 理由 |
|---|---|---|
| 金額型別 | `INTEGER`,單位 = 新台幣元 | 台幣無小數,避免 `REAL` 浮點誤差。若日後要支援分,改成「以分為單位的整數」即可,不必改型別 |
| 時間型別 | `TEXT`,ISO-8601 UTC(`YYYY-MM-DD HH:MM:SS`) | SQLite 沒有原生 datetime;字串可直接字典序比較,且能餵給 `datetime()` |
| 主鍵 | `INTEGER PRIMARY KEY`(即 rowid 別名) | SQLite 上最快、最省空間 |
| 菜單品項 | **不建表**,品項名稱由跟單者自由輸入 | 菜單是外部網址,店家隨時改菜單;硬要同步反而是負債 |
| 運費規則 | 建團時從 `shop` **快照**進 `team_order` | 店家日後調運費不能回頭改動歷史團的結算 |
| 結算 | 結算後把每人金額**寫死**進 `settlement_share` | 結算是一次性事件,不能因為之後有人補改品項就變動 |

需要 SQLite **3.37+**(用了 `STRICT` 資料表)。若環境較舊,把所有 `STRICT` 拿掉即可,其餘語法相容到 3.31(generated columns)。

## 完整 DDL

```sql
-- ============================================================
-- 部門揪團訂飲料系統 — SQLite schema
-- 需求:SQLite 3.37+(STRICT tables)
-- ============================================================

PRAGMA foreign_keys = ON;          -- 每次連線都要開,不是持久設定
PRAGMA journal_mode = WAL;         -- 多人同時跟單時讀寫不互卡

-- ------------------------------------------------------------
-- 1. member — 部門成員
-- ------------------------------------------------------------
CREATE TABLE member (
    id            INTEGER PRIMARY KEY,
    display_name  TEXT    NOT NULL,                      -- 顯示名稱,如「小明」
    email         TEXT    UNIQUE,                        -- 可為 NULL(只用暱稱的人)
    is_active     INTEGER NOT NULL DEFAULT 1
                          CHECK (is_active IN (0, 1)),   -- 離職/調departmet 改 0,不刪 row
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now')),

    CHECK (length(trim(display_name)) > 0)
) STRICT;

CREATE UNIQUE INDEX idx_member_name ON member(display_name);


-- ------------------------------------------------------------
-- 2. shop — 店家(含預設運費規則)
--    這裡的運費規則只是「開團時的預設值」,實際以 team_order 快照為準
-- ------------------------------------------------------------
CREATE TABLE shop (
    id                       INTEGER PRIMARY KEY,
    name                     TEXT    NOT NULL UNIQUE,
    menu_url                 TEXT,                        -- 菜單網址,可為 NULL
    phone                    TEXT,
    default_delivery_fee     INTEGER NOT NULL DEFAULT 0
                                     CHECK (default_delivery_fee >= 0),
    -- 滿額免運門檻:NULL = 沒有免運優惠(運費永遠要收)
    default_free_ship_min    INTEGER CHECK (default_free_ship_min > 0),
    is_active                INTEGER NOT NULL DEFAULT 1
                                     CHECK (is_active IN (0, 1)),
    note                     TEXT,
    created_at               TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now')),

    CHECK (length(trim(name)) > 0)
) STRICT;


-- ------------------------------------------------------------
-- 3. team_order — 一次揪團
--    運費規則在此快照,店家日後改價不影響已開的團
-- ------------------------------------------------------------
CREATE TABLE team_order (
    id                INTEGER PRIMARY KEY,
    shop_id           INTEGER NOT NULL REFERENCES shop(id) ON DELETE RESTRICT,
    opener_id         INTEGER NOT NULL REFERENCES member(id) ON DELETE RESTRICT,

    title             TEXT,                               -- 「週五下午茶」之類,可空
    menu_url          TEXT,                               -- 快照;開團時通常帶 shop.menu_url
    deadline_at       TEXT    NOT NULL,                   -- 截止時間(UTC ISO-8601)

    -- ---- 運費規則快照 ----
    delivery_fee      INTEGER NOT NULL DEFAULT 0
                              CHECK (delivery_fee >= 0),
    free_ship_min     INTEGER CHECK (free_ship_min > 0),  -- NULL = 無免運門檻
    -- 外送費分攤方式:均分給有跟單的人 / 開團者自行吸收
    fee_split_mode    TEXT    NOT NULL DEFAULT 'even'
                              CHECK (fee_split_mode IN ('even', 'opener_absorbs')),

    status            TEXT    NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open', 'closed', 'settled', 'cancelled')),

    created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now')),
    closed_at         TEXT,
    settled_at        TEXT,

    -- 狀態與時間戳一致性
    CHECK (status <> 'settled' OR settled_at IS NOT NULL),
    CHECK (deadline_at > created_at)
) STRICT;

CREATE INDEX idx_team_order_status   ON team_order(status, deadline_at);
CREATE INDEX idx_team_order_shop     ON team_order(shop_id);
CREATE INDEX idx_team_order_opener   ON team_order(opener_id);


-- ------------------------------------------------------------
-- 4. order_line — 跟單的單一品項
--    同一人在同一團可以有多筆(點兩杯不同的)
-- ------------------------------------------------------------
CREATE TABLE order_line (
    id            INTEGER PRIMARY KEY,
    team_order_id INTEGER NOT NULL REFERENCES team_order(id) ON DELETE CASCADE,
    member_id     INTEGER NOT NULL REFERENCES member(id)     ON DELETE RESTRICT,

    item_name     TEXT    NOT NULL,                       -- 「珍珠奶茶 大」
    unit_price    INTEGER NOT NULL CHECK (unit_price >= 0),
    quantity      INTEGER NOT NULL DEFAULT 1
                          CHECK (quantity > 0),
    note          TEXT,                                   -- 「少冰半糖、去珍珠」

    -- 小計由資料庫算,應用層不可能算錯
    line_total    INTEGER GENERATED ALWAYS AS (unit_price * quantity) STORED,

    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now')),
    updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now')),

    CHECK (length(trim(item_name)) > 0)
) STRICT;

CREATE INDEX idx_order_line_team        ON order_line(team_order_id);
CREATE INDEX idx_order_line_team_member ON order_line(team_order_id, member_id);


-- ------------------------------------------------------------
-- 5. settlement — 結算表頭(一團最多一筆)
--    截止後產生,金額寫死不再重算
-- ------------------------------------------------------------
CREATE TABLE settlement (
    team_order_id     INTEGER PRIMARY KEY
                              REFERENCES team_order(id) ON DELETE CASCADE,

    items_total       INTEGER NOT NULL CHECK (items_total >= 0),   -- 所有品項小計加總
    delivery_fee      INTEGER NOT NULL CHECK (delivery_fee >= 0),  -- 實收運費(免運則為 0)
    free_ship_applied INTEGER NOT NULL DEFAULT 0
                              CHECK (free_ship_applied IN (0, 1)), -- 是否觸發滿額免運
    grand_total       INTEGER NOT NULL CHECK (grand_total >= 0),   -- items_total + delivery_fee
    participant_count INTEGER NOT NULL CHECK (participant_count > 0),

    settled_by        INTEGER NOT NULL REFERENCES member(id) ON DELETE RESTRICT,
    settled_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now')),
    note              TEXT,

    CHECK (grand_total = items_total + delivery_fee),
    CHECK (free_ship_applied = 0 OR delivery_fee = 0)
) STRICT;


-- ------------------------------------------------------------
-- 6. settlement_share — 結算明細,每位參與者一筆
--    這張表就是「誰該付多少」的最終答案
-- ------------------------------------------------------------
CREATE TABLE settlement_share (
    id              INTEGER PRIMARY KEY,
    team_order_id   INTEGER NOT NULL REFERENCES settlement(team_order_id) ON DELETE CASCADE,
    member_id       INTEGER NOT NULL REFERENCES member(id) ON DELETE RESTRICT,

    items_subtotal  INTEGER NOT NULL CHECK (items_subtotal >= 0),  -- 該員品項小計
    delivery_share  INTEGER NOT NULL DEFAULT 0
                            CHECK (delivery_share >= 0),           -- 分攤到的運費(含餘數)
    amount_due      INTEGER NOT NULL CHECK (amount_due >= 0),

    paid_at         TEXT,                                          -- NULL = 還沒付錢
    paid_note       TEXT,                                          -- 「轉帳 0827」

    UNIQUE (team_order_id, member_id),
    CHECK (amount_due = items_subtotal + delivery_share)
) STRICT;

CREATE INDEX idx_share_member  ON settlement_share(member_id, paid_at);
CREATE INDEX idx_share_unpaid  ON settlement_share(team_order_id) WHERE paid_at IS NULL;
```

## 觸發器 — 把規則放在資料庫,不是每支 API 各寫一遍

```sql
-- 截止之後不能再跟單
CREATE TRIGGER trg_order_line_no_insert_after_deadline
BEFORE INSERT ON order_line
FOR EACH ROW
WHEN EXISTS (
    SELECT 1 FROM team_order t
    WHERE t.id = NEW.team_order_id
      AND (t.status <> 'open'
           OR t.deadline_at <= strftime('%Y-%m-%d %H:%M:%S', 'now'))
)
BEGIN
    SELECT RAISE(ABORT, 'team order is closed or past deadline');
END;

-- 已結算的團不能改品項
CREATE TRIGGER trg_order_line_no_update_after_settle
BEFORE UPDATE ON order_line
FOR EACH ROW
WHEN EXISTS (
    SELECT 1 FROM team_order t
    WHERE t.id = NEW.team_order_id AND t.status IN ('settled', 'cancelled')
)
BEGIN
    SELECT RAISE(ABORT, 'team order already settled');
END;

CREATE TRIGGER trg_order_line_no_delete_after_settle
BEFORE DELETE ON order_line
FOR EACH ROW
WHEN EXISTS (
    SELECT 1 FROM team_order t
    WHERE t.id = OLD.team_order_id AND t.status IN ('settled', 'cancelled')
)
BEGIN
    SELECT RAISE(ABORT, 'team order already settled');
END;

-- updated_at 自動維護
CREATE TRIGGER trg_order_line_touch
AFTER UPDATE ON order_line
FOR EACH ROW
BEGIN
    UPDATE order_line
       SET updated_at = strftime('%Y-%m-%d %H:%M:%S', 'now')
     WHERE id = NEW.id;
END;
```

## 檢視表 — 開團中即時看金額

```sql
-- 每人在每團的即時小計(未結算前用這個)
CREATE VIEW v_member_subtotal AS
SELECT
    ol.team_order_id,
    ol.member_id,
    m.display_name,
    COUNT(*)             AS line_count,
    SUM(ol.quantity)     AS total_qty,
    SUM(ol.line_total)   AS items_subtotal
FROM order_line ol
JOIN member m ON m.id = ol.member_id
GROUP BY ol.team_order_id, ol.member_id;

-- 全團即時狀態,含免運判斷
CREATE VIEW v_team_order_live AS
SELECT
    t.id                                    AS team_order_id,
    s.name                                  AS shop_name,
    t.status,
    t.deadline_at,
    COALESCE(SUM(ol.line_total), 0)         AS items_total,
    COUNT(DISTINCT ol.member_id)            AS participant_count,
    CASE
        WHEN t.free_ship_min IS NOT NULL
         AND COALESCE(SUM(ol.line_total), 0) >= t.free_ship_min
        THEN 1 ELSE 0
    END                                     AS free_ship_applied,
    CASE
        WHEN t.free_ship_min IS NOT NULL
         AND COALESCE(SUM(ol.line_total), 0) >= t.free_ship_min
        THEN 0 ELSE t.delivery_fee
    END                                     AS effective_delivery_fee,
    -- 還差多少可免運(已達標或無門檻則為 0)
    CASE
        WHEN t.free_ship_min IS NULL THEN 0
        WHEN COALESCE(SUM(ol.line_total), 0) >= t.free_ship_min THEN 0
        ELSE t.free_ship_min - COALESCE(SUM(ol.line_total), 0)
    END                                     AS amount_to_free_ship
FROM team_order t
JOIN shop s        ON s.id = t.shop_id
LEFT JOIN order_line ol ON ol.team_order_id = t.id
GROUP BY t.id;
```

## 結算流程(應用層)

均分外送費會有除不盡的餘數(例如 60 元 ÷ 7 人)。**不要用浮點數**,做法是:

1. `base = effective_delivery_fee / participant_count`(整數除法)
2. `remainder = effective_delivery_fee % participant_count`
3. 依 `member_id` 排序,前 `remainder` 人各多付 1 元

這樣加總必然等於 `effective_delivery_fee`,`settlement` 的 `CHECK (grand_total = items_total + delivery_fee)` 才不會爆。

```sql
BEGIN IMMEDIATE;

UPDATE team_order
   SET status = 'closed',
       closed_at = strftime('%Y-%m-%d %H:%M:%S', 'now')
 WHERE id = :tid AND status = 'open';

INSERT INTO settlement (
    team_order_id, items_total, delivery_fee,
    free_ship_applied, grand_total, participant_count, settled_by)
SELECT
    team_order_id, items_total, effective_delivery_fee,
    free_ship_applied, items_total + effective_delivery_fee,
    participant_count, :me
FROM v_team_order_live
WHERE team_order_id = :tid;

-- 明細:base + 餘數分配(ROW_NUMBER 需要 SQLite 3.25+)
INSERT INTO settlement_share (
    team_order_id, member_id, items_subtotal, delivery_share, amount_due)
WITH s AS (
    SELECT delivery_fee, participant_count FROM settlement WHERE team_order_id = :tid
),
ranked AS (
    SELECT v.member_id, v.items_subtotal,
           ROW_NUMBER() OVER (ORDER BY v.member_id) AS rn
    FROM v_member_subtotal v
    WHERE v.team_order_id = :tid
)
SELECT :tid, r.member_id, r.items_subtotal,
       (SELECT delivery_fee / participant_count FROM s)
         + CASE WHEN r.rn <= (SELECT delivery_fee % participant_count FROM s)
                THEN 1 ELSE 0 END,
       r.items_subtotal
         + (SELECT delivery_fee / participant_count FROM s)
         + CASE WHEN r.rn <= (SELECT delivery_fee % participant_count FROM s)
                THEN 1 ELSE 0 END
FROM ranked r;

UPDATE team_order
   SET status = 'settled',
       settled_at = strftime('%Y-%m-%d %H:%M:%S', 'now')
 WHERE id = :tid;

COMMIT;
```

`fee_split_mode = 'opener_absorbs'` 時,把 `delivery_share` 全部給 `opener_id`、其他人為 0 即可,其餘流程不變。

## 幾個刻意的取捨

- **`member` 用 `ON DELETE RESTRICT`**:離職就把 `is_active` 設 0,不刪 row,否則歷史帳會斷。
- **`order_line` 用 `ON DELETE CASCADE`**:團被取消時品項一起消失是合理的。
- **不做 `payment` 表**:部門內部揪團,收款狀態一團一人一筆就夠,直接放在 `settlement_share.paid_at`。真的要記多次部分付款再抽表。
- **`settlement_share` 的 FK 指向 `settlement` 而非 `team_order`**:確保明細不可能在表頭不存在時出現。
- **不存「未付總額」欄位**:那是 `SUM(amount_due) WHERE paid_at IS NULL` 的查詢,存起來只會不同步。
