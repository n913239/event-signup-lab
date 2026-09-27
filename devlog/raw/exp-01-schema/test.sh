#!/usr/bin/env bash
# 以暫存 DB 跑過主要情境：保留、搶同一座位、額滿、過期後被接手、確認出票
set -u
DB=$(mktemp -t evtdb).db
trap 'rm -f "$DB"' EXIT
q() { sqlite3 -bail "$DB" "PRAGMA foreign_keys=ON; $1" 2>&1; }

sqlite3 "$DB" < "$(dirname "$0")/schema.sql" >/dev/null

q "INSERT INTO events(id,title,starts_at,status,hold_seconds) VALUES (1,'演唱會',unixepoch()+86400,'published',600);
   INSERT INTO ticket_types(id,event_id,name,price,is_seated,quota) VALUES
     (1,1,'VIP 區',3000,1,NULL),(2,1,'站票',800,0,2);
   INSERT INTO seats(id,event_id,ticket_type_id,section,row_label,seat_number) VALUES
     (1,1,1,'A','1','1'),(2,1,1,'A','1','2');"

hold() { # $1=reservation id, $2=expires_at 表達式
  q "INSERT INTO reservations(id,event_id,contact_name,contact_email,expires_at)
     VALUES ($1,1,'u$1','u$1@x.tw',$2);"
}
grab() { # $1=rid, $2=seat → 印出 changes()
  q "UPDATE seats SET reservation_id=$1, lock_expires_at=(SELECT expires_at FROM reservations WHERE id=$1)
     WHERE id=$2 AND is_blocked=0 AND (reservation_id IS NULL OR lock_expires_at<=unixepoch());
     SELECT changes();"
}

echo "== 1. 使用者 10 保留座位 1"
hold 10 "unixepoch()+600"
echo "grab -> $(grab 10 1)  (預期 1)"
q "INSERT INTO reservation_items(reservation_id,ticket_type_id,seat_id,unit_price) VALUES (10,1,1,3000);"

echo "== 2. 使用者 11 搶同一座位"
hold 11 "unixepoch()+600"
echo "grab -> $(grab 11 1)  (預期 0)"
echo "硬塞 item -> $(q "INSERT INTO reservation_items(reservation_id,ticket_type_id,seat_id,unit_price) VALUES (11,1,1,3000);")"

echo "== 3. 站票名額 2，買第 3 張"
q "INSERT INTO reservation_items(reservation_id,ticket_type_id,unit_price) VALUES (11,2,800),(11,2,800);"
echo "第 3 張 -> $(q "INSERT INTO reservation_items(reservation_id,ticket_type_id,unit_price) VALUES (10,2,800);")"

echo "== 4. 使用者 12 的保留已過期，座位 2 可被 13 接手"
hold 12 "unixepoch()-1"
grab 12 2 >/dev/null
hold 13 "unixepoch()+600"
echo "grab -> $(grab 13 2)  (預期 1)"

echo "== 5. 確認 10 並出票"
q "BEGIN IMMEDIATE;
   UPDATE reservations SET status='confirmed', confirmed_at=unixepoch()
    WHERE id=10 AND status='held' AND expires_at>unixepoch();
   UPDATE seats SET lock_expires_at=NULL WHERE reservation_id=10;
   INSERT INTO tickets(reservation_item_id) SELECT id FROM reservation_items WHERE reservation_id=10;
   COMMIT;"
echo "重複出票 -> $(q "INSERT INTO tickets(reservation_item_id) SELECT id FROM reservation_items WHERE reservation_id=10;")"
echo "確認已過期的 12 -> changes=$(q "UPDATE reservations SET status='confirmed', confirmed_at=unixepoch()
   WHERE id=12 AND status='held' AND expires_at>unixepoch(); SELECT changes();")  (預期 0)"

echo "== 座位狀態"
sqlite3 -box "$DB" "SELECT id,row_label||'-'||seat_number seat,reservation_id,state FROM v_seat_status;
   SELECT name,capacity,sold,held FROM v_ticket_type_availability;"
