package com.example.eventreg.util

/** 座位固定 10×10:列 A–J、欄 1–10,座號如 `A1`、`J10`。 */
val SEAT_ROWS: List<Char> = ('A'..'J').toList()
val SEAT_COLS: IntRange = 1..10

/** 依列再依欄排序;字串排序會把 A10 排在 A2 前面。 */
fun sortSeatNos(seatNos: Collection<String>): List<String> =
    seatNos.sortedWith(compareBy({ it.firstOrNull() ?: ' ' }, { it.drop(1).toIntOrNull() ?: 0 }))
