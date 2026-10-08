package tw.example.eventsignup.ui.seats

import tw.example.eventsignup.api.models.Seat

/** 座位固定 10×10:列 A–J、欄 1–10(契約 SeatNo `^[A-J](10|[1-9])$`)。 */
val SEAT_ROWS: List<Char> = ('A'..'J').toList()
val SEAT_COLUMNS: List<Int> = (1..10).toList()

fun seatNo(row: Char, column: Int): String = "$row$column"

/**
 * 把 API 回來的 100 筆座位(順序不保證)排成 10×10 格。
 * 回應裡缺的座位放 null,畫面上顯示成未知,不假裝是空位。
 */
fun buildSeatGrid(seats: List<Seat>): List<List<Seat.State?>> {
    val byNo = seats.associate { it.seatNo to it.state }
    return SEAT_ROWS.map { row -> SEAT_COLUMNS.map { col -> byNo[seatNo(row, col)] } }
}

fun Seat.State?.label(): String = when (this) {
    Seat.State.FREE -> "空位"
    Seat.State.HELD -> "保留中"
    Seat.State.SOLD -> "已售"
    Seat.State.MINE -> "我的"
    null -> "未知"
}
