package com.example.eventsignup.ui.events

import androidx.compose.foundation.background
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.eventsignup.api.models.Seat

/** 座位四種狀態(Seat.state:free / held / sold / mine)。 */
enum class SeatLook(val apiValue: String, val label: String, val bg: Color, val fg: Color) {
    FREE("free", "空位", Color(0xFFE0E0E0), Color(0xFF424242)),
    HELD("held", "保留中", Color(0xFFFFC107), Color(0xFF3E2723)),
    SOLD("sold", "已售", Color(0xFF616161), Color.White),
    MINE("mine", "我的", Color(0xFF2E7D32), Color.White);

    companion object {
        fun of(apiValue: String?): SeatLook? = entries.firstOrNull { it.apiValue == apiValue }
    }
}

private val ROWS = 'A'..'J'
private val COLS = 1..10

/**
 * 10×10 座位圖,唯讀不可點(同 iOS:App 端不做選位)。
 * 不靠伺服器回傳順序:依座號(A1…J10)擺到固定格子,缺的格子畫成空白框。
 */
@Composable
fun SeatGrid(seats: List<Seat>, modifier: Modifier = Modifier) {
    val byNo = seats.associateBy { it.seatNo }
    Column(modifier.testTag("seat_grid"), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        for (row in ROWS) {
            Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                for (col in COLS) {
                    val no = "$row$col"
                    SeatCell(no, SeatLook.of(byNo[no]?.state?.value), Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun SeatCell(no: String, look: SeatLook?, modifier: Modifier) {
    Box(
        modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(4.dp))
            .background(look?.bg ?: Color.Transparent)
            .semantics { contentDescription = "$no ${look?.label ?: "未知"}" }
            .testTag("seat_$no"),
        contentAlignment = Alignment.Center,
    ) {
        Text(no, fontSize = 9.sp, color = look?.fg ?: MaterialTheme.colorScheme.onSurface)
    }
}

@Composable
fun SeatLegend(seats: List<Seat>, modifier: Modifier = Modifier) {
    val counts = seats.groupingBy { it.state.value }.eachCount()
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        SeatLook.entries.forEach { look ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Box(Modifier.size(12.dp).clip(RoundedCornerShape(2.dp)).background(look.bg))
                Text("${look.label} ${counts[look.apiValue] ?: 0}", style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}
