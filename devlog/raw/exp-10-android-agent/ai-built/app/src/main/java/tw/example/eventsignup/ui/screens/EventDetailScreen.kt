package tw.example.eventsignup.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.testTag
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import tw.example.eventsignup.api.models.EventDetail
import tw.example.eventsignup.api.models.Seat
import tw.example.eventsignup.data.EventSignupRepository
import tw.example.eventsignup.ui.common.LoadableContent
import tw.example.eventsignup.ui.common.rememberLoad
import tw.example.eventsignup.ui.format.formatEpochMs
import tw.example.eventsignup.ui.seats.SEAT_COLUMNS
import tw.example.eventsignup.ui.seats.SEAT_ROWS
import tw.example.eventsignup.ui.seats.buildSeatGrid
import tw.example.eventsignup.ui.seats.label
import tw.example.eventsignup.ui.seats.seatNo

@Composable
fun EventDetailScreen(repository: EventSignupRepository, eventId: String) {
    val loaded = rememberLoad(eventId) { repository.getEvent(eventId) }
    LoadableContent(loaded) { event -> EventDetailContent(event) }
}

@Composable
private fun EventDetailContent(event: EventDetail) {
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(event.name, style = MaterialTheme.typography.titleLarge, modifier = Modifier.testTag("event_detail_name"))
        Text("開賣:${formatEpochMs(event.opensAt)}")
        Text("截止:${formatEpochMs(event.deadlineAt)}")
        Text("剩餘 ${event.remainingSeats} 席", color = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.size(8.dp))
        SeatLegend()
        SeatMap(event.seats)
    }
}

private data class SeatStyle(val fill: Color, val content: Color, val outline: Color)

@Composable
private fun seatStyle(state: Seat.State?): SeatStyle = when (state) {
    Seat.State.FREE -> SeatStyle(Color.White, Color(0xFF37474F), Color(0xFF90A4AE))
    Seat.State.HELD -> SeatStyle(Color(0xFFFFC107), Color.Black, Color(0xFFFFA000))
    Seat.State.SOLD -> SeatStyle(Color(0xFF616161), Color.White, Color(0xFF424242))
    Seat.State.MINE -> SeatStyle(Color(0xFF2E7D32), Color.White, Color(0xFF1B5E20))
    null -> SeatStyle(Color(0xFFE0E0E0), Color(0xFF9E9E9E), Color(0xFFBDBDBD))
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SeatLegend() {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.testTag("seat_legend")) {
        listOf(Seat.State.FREE, Seat.State.HELD, Seat.State.SOLD, Seat.State.MINE).forEach { state ->
            val style = seatStyle(state)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(14.dp)
                        .background(style.fill, RoundedCornerShape(3.dp))
                        .border(1.dp, style.outline, RoundedCornerShape(3.dp)),
                )
                Text(state.label(), modifier = Modifier.padding(start = 4.dp), style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

/** 唯讀座位圖:不可點選。每格帶 contentDescription(例:「A1 空位」),不只靠顏色區分。 */
@Composable
private fun SeatMap(seats: List<Seat>) {
    val grid = buildSeatGrid(seats)
    Column(Modifier.fillMaxWidth().testTag("seat_map"), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            Spacer(Modifier.width(18.dp))
            SEAT_COLUMNS.forEach { col ->
                Text(
                    "$col",
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.labelSmall,
                )
            }
        }
        SEAT_ROWS.forEachIndexed { r, row ->
            Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("$row", modifier = Modifier.width(18.dp), style = MaterialTheme.typography.labelSmall)
                SEAT_COLUMNS.forEachIndexed { c, col ->
                    val no = seatNo(row, col)
                    val state = grid[r][c]
                    val style = seatStyle(state)
                    Box(
                        Modifier.weight(1f)
                            .aspectRatio(1f)
                            .background(style.fill, RoundedCornerShape(4.dp))
                            .border(1.dp, style.outline, RoundedCornerShape(4.dp))
                            .clearAndSetSemantics {
                                testTag = "seat_$no"
                                contentDescription = "$no ${state.label()}"
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(no, color = style.content, fontSize = 9.sp)
                    }
                }
            }
        }
    }
}
