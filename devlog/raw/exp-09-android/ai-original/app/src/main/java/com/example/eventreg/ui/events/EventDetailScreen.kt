package com.example.eventreg.ui.events

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.eventreg.api.models.EventDetail
import com.example.eventreg.ui.common.BackTopBar
import com.example.eventreg.ui.common.InfoRow
import com.example.eventreg.ui.common.LoadState
import com.example.eventreg.ui.common.LoadStateContent
import com.example.eventreg.ui.common.LoaderViewModel
import com.example.eventreg.util.formatCents
import com.example.eventreg.util.formatEpochMs

@Composable
fun EventDetailScreen(vm: LoaderViewModel<EventDetail>, onBack: () -> Unit) {
    val state by vm.state.collectAsStateWithLifecycle()
    val title = (state as? LoadState.Ready)?.data?.name ?: "活動"
    Scaffold(topBar = { BackTopBar(title, onBack) }) { padding ->
        LoadStateContent(state, onRetry = vm::reload, modifier = Modifier.padding(padding)) { event ->
            EventDetailContent(event)
        }
    }
}

@Composable
private fun EventDetailContent(event: EventDetail) {
    val seats = remember(event) { event.seats.associate { it.seatNo to SeatState.fromWire(it.state.value) } }
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
            .testTag("event_detail"),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(event.name, style = MaterialTheme.typography.headlineSmall)
        InfoRow("開賣", formatEpochMs(event.opensAt))
        InfoRow("截止", formatEpochMs(event.deadlineAt))
        InfoRow("剩餘", "${event.remainingSeats} 席")

        if (event.ticketTypes.isNotEmpty()) {
            HorizontalDivider()
            Text("票種", style = MaterialTheme.typography.titleMedium)
            event.ticketTypes.forEach { type ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(type.name, modifier = Modifier.weight(1f))
                    Text("剩 ${type.remaining} / ${type.capacity}", modifier = Modifier.padding(horizontal = 12.dp))
                    Text(formatCents(type.priceCents))
                }
            }
        }

        HorizontalDivider()
        Text("座位圖", style = MaterialTheme.typography.titleMedium)
        SeatGrid(seats, Modifier.fillMaxWidth())
        SeatLegend(Modifier.padding(top = 8.dp))
    }
}
