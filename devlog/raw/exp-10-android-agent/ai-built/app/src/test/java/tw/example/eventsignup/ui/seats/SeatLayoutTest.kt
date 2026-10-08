package tw.example.eventsignup.ui.seats

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import tw.example.eventsignup.api.models.Seat

class SeatLayoutTest {

    private fun allSeats(stateFor: (String) -> Seat.State): List<Seat> =
        SEAT_ROWS.flatMap { r -> SEAT_COLUMNS.map { c -> seatNo(r, c) } }.map { Seat(it, stateFor(it)) }

    @Test fun `grid is 10 by 10 with rows A to J and columns 1 to 10`() {
        val grid = buildSeatGrid(allSeats { Seat.State.FREE })
        assertEquals(10, grid.size)
        grid.forEach { assertEquals(10, it.size) }
        assertEquals("A1", seatNo(SEAT_ROWS.first(), SEAT_COLUMNS.first()))
        assertEquals("J10", seatNo(SEAT_ROWS.last(), SEAT_COLUMNS.last()))
    }

    @Test fun `seats are placed by seat number regardless of response order`() {
        val states = mapOf("A1" to Seat.State.MINE, "B10" to Seat.State.SOLD, "J10" to Seat.State.HELD)
        val seats = allSeats { states[it] ?: Seat.State.FREE }.shuffled(java.util.Random(42))

        val grid = buildSeatGrid(seats)

        assertEquals(Seat.State.MINE, grid[0][0])
        assertEquals(Seat.State.SOLD, grid[1][9])
        assertEquals(Seat.State.HELD, grid[9][9])
        assertEquals(Seat.State.FREE, grid[0][1])
    }

    @Test fun `seat 10 is not confused with seat 1`() {
        val grid = buildSeatGrid(listOf(Seat("C10", Seat.State.SOLD)))
        assertNull(grid[2][0])
        assertEquals(Seat.State.SOLD, grid[2][9])
    }

    @Test fun `missing seats are unknown rather than free`() {
        val grid = buildSeatGrid(emptyList())
        assertNull(grid[0][0])
        assertEquals("未知", grid[0][0].label())
    }

    @Test fun `all four states have labels`() {
        assertEquals(listOf("空位", "保留中", "已售", "我的"), Seat.State.entries.map { it.label() })
    }
}
