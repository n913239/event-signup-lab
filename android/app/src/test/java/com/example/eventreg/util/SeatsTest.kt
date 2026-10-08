package com.example.eventreg.util

import org.junit.Assert.assertEquals
import org.junit.Test

class SeatsTest {
    @Test
    fun sortsByRowThenNumericColumn() {
        assertEquals(
            listOf("A1", "A2", "A10", "B1", "J10"),
            sortSeatNos(listOf("A10", "J10", "B1", "A2", "A1")),
        )
    }

    @Test
    fun gridIsTenByTen() {
        assertEquals(100, SEAT_ROWS.size * SEAT_COLS.count())
    }
}
