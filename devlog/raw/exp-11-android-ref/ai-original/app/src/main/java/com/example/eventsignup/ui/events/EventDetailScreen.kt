package com.example.eventsignup.ui.events

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.example.eventsignup.api.apis.EventsApi
import com.example.eventsignup.api.models.EventDetail
import com.example.eventsignup.ui.common.BackButton
import com.example.eventsignup.ui.common.Loadable
import com.example.eventsignup.ui.common.LoadableContent
import com.example.eventsignup.ui.common.fetch
import com.example.eventsignup.util.Money
import com.example.eventsignup.util.Time

/** 活動明細:GET /events/{id},票種 + 100 席四色座位圖(唯讀)。 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventDetailScreen(api: EventsApi, id: String, onBack: () -> Unit) {
    var reload by remember { mutableIntStateOf(0) }
    var state by remember { mutableStateOf<Loadable<EventDetail>>(Loadable.Loading) }
    LaunchedEffect(id, reload) {
        state = Loadable.Loading
        state = fetch { api.getEvent(id) }
    }
    val title = (state as? Loadable.Ready)?.value?.name ?: "座位"

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                navigationIcon = { BackButton(onBack) },
            )
        },
    ) { padding ->
        LoadableContent(state, onRetry = { reload++ }, modifier = Modifier.padding(padding)) { d ->
            Column(
                Modifier.verticalScroll(rememberScrollState()).padding(16.dp).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("開賣 ${Time.format(d.opensAt)}・截止 ${Time.format(d.deadlineAt)}", style = MaterialTheme.typography.bodySmall)
                Text("剩 ${d.remainingSeats} 席", style = MaterialTheme.typography.bodyMedium)
                d.ticketTypes.forEach { t ->
                    Text(
                        "${t.name}・${Money.format(t.priceCents)}・剩 ${t.remaining}",
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.testTag("ticket_type"),
                    )
                }
                SeatLegend(d.seats, Modifier.padding(top = 8.dp))
                SeatGrid(d.seats, Modifier.fillMaxWidth())
            }
        }
    }
}
