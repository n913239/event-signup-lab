package com.example.eventreg.ui.events

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.eventreg.util.SEAT_COLS
import com.example.eventreg.util.SEAT_ROWS

/** 對應 API 的 Seat.state;多一個 UNKNOWN 給「回應裡缺這個座號」的情況。 */
enum class SeatState(val label: String, val glyph: String) {
    FREE("空位", ""),
    HELD("保留中", "保"),
    SOLD("已售", "售"),
    MINE("我的", "我"),
    UNKNOWN("未知", "?");

    companion object {
        fun fromWire(value: String): SeatState = when (value) {
            "free" -> FREE
            "held" -> HELD
            "sold" -> SOLD
            "mine" -> MINE
            else -> UNKNOWN
        }
    }
}

private data class SeatColors(val background: Color, val content: Color, val border: Color)

@Composable
private fun colorsFor(state: SeatState): SeatColors {
    val scheme = MaterialTheme.colorScheme
    return when (state) {
        SeatState.FREE -> SeatColors(scheme.surface, scheme.onSurface, scheme.outline)
        SeatState.HELD -> SeatColors(Color(0xFFFFB300), Color.Black, Color(0xFFFFB300))
        SeatState.SOLD -> SeatColors(Color(0xFF9E9E9E), Color.White, Color(0xFF9E9E9E))
        SeatState.MINE -> SeatColors(Color(0xFF2E7D32), Color.White, Color(0xFF2E7D32))
        SeatState.UNKNOWN -> SeatColors(scheme.surfaceVariant, scheme.onSurfaceVariant, scheme.outlineVariant)
    }
}

/** 唯讀 10×10 座位圖。顏色之外每格另有文字標記,色弱也分得出來。 */
@Composable
fun SeatGrid(seats: Map<String, SeatState>, modifier: Modifier = Modifier) {
    Column(modifier.testTag("seat_grid"), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            AxisLabel("", Modifier.weight(1f))
            SEAT_COLS.forEach { col -> AxisLabel("$col", Modifier.weight(1f)) }
        }
        SEAT_ROWS.forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                AxisLabel("$row", Modifier.weight(1f))
                SEAT_COLS.forEach { col ->
                    val seatNo = "$row$col"
                    val state = seats[seatNo] ?: SeatState.UNKNOWN
                    SeatCell(
                        state = state,
                        modifier = Modifier
                            .weight(1f)
                            .testTag("seat_$seatNo")
                            .semantics { contentDescription = "$seatNo ${state.label}" },
                    )
                }
            }
        }
    }
}

@Composable
fun SeatLegend(modifier: Modifier = Modifier) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        listOf(SeatState.FREE, SeatState.HELD, SeatState.SOLD, SeatState.MINE).forEach { state ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                SeatCell(state, Modifier.size(20.dp))
                Text(state.label, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun SeatCell(state: SeatState, modifier: Modifier = Modifier) {
    val colors = colorsFor(state)
    val shape = RoundedCornerShape(4.dp)
    Box(
        modifier
            .aspectRatio(1f)
            .clip(shape)
            .background(colors.background)
            .border(1.dp, colors.border, shape),
        contentAlignment = Alignment.Center,
    ) {
        if (state.glyph.isNotEmpty()) {
            Text(state.glyph, color = colors.content, fontSize = 11.sp, lineHeight = 11.sp)
        }
    }
}

@Composable
private fun AxisLabel(text: String, modifier: Modifier) {
    Text(
        text,
        modifier = modifier,
        textAlign = TextAlign.Center,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}
