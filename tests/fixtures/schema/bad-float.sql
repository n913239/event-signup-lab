CREATE TABLE members (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, pw_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','staff')), created_at INTEGER NOT NULL) STRICT;
CREATE TABLE refresh_tokens (id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, revoked_at INTEGER) STRICT;
CREATE TABLE events (id INTEGER PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('draft','on_sale','closed','finished','cancelled')), opens_at INTEGER NOT NULL, deadline_at INTEGER NOT NULL, created_at INTEGER NOT NULL) STRICT;
CREATE TABLE ticket_types (id INTEGER PRIMARY KEY, event_id INTEGER NOT NULL, name TEXT NOT NULL, price REAL NOT NULL, remaining INTEGER NOT NULL CHECK (remaining >= 0), early_bird_until INTEGER) STRICT;
CREATE TABLE seat_holds (id INTEGER PRIMARY KEY, event_id INTEGER NOT NULL, seat_no TEXT NOT NULL, member_id INTEGER NOT NULL, status TEXT NOT NULL CHECK (status IN ('holding','confirmed','expired','cancelled')), expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL) STRICT;
CREATE UNIQUE INDEX ux_seat_active ON seat_holds(event_id, seat_no) WHERE status IN ('holding','confirmed');
CREATE TABLE orders (id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL, event_id INTEGER NOT NULL, status TEXT NOT NULL CHECK (status IN ('confirmed','checked_in','cancelled')), total_cents INTEGER NOT NULL, created_at INTEGER NOT NULL) STRICT;
CREATE TABLE order_items (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL, ticket_type_id INTEGER NOT NULL, seat_no TEXT NOT NULL, unit_price REAL NOT NULL) STRICT;
CREATE TABLE promo_codes (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, pct INTEGER NOT NULL, valid_until INTEGER NOT NULL) STRICT;
