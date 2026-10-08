package tw.example.eventsignup.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import tw.example.eventsignup.api.models.EventSummary
import tw.example.eventsignup.data.EventSignupRepository
import tw.example.eventsignup.ui.common.LoadableContent
import tw.example.eventsignup.ui.common.rememberLoad
import tw.example.eventsignup.ui.format.formatEpochMs

@Composable
fun EventListScreen(repository: EventSignupRepository, onOpen: (String) -> Unit) {
    val loaded = rememberLoad(Unit) { repository.listOnSaleEvents() }
    LoadableContent(loaded) { events ->
        if (events.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("目前沒有開賣中的活動", modifier = Modifier.testTag("events_empty"))
            }
        } else {
            LazyColumn(
                Modifier.fillMaxSize().testTag("event_list"),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(events, key = { it.id }) { event -> EventCard(event, onClick = { onOpen(event.id) }) }
            }
        }
    }
}

@Composable
private fun EventCard(event: EventSummary, onClick: () -> Unit) {
    Card(Modifier.fillMaxWidth().clickable(onClick = onClick).testTag("event_item")) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(event.name, style = MaterialTheme.typography.titleMedium)
            Text("開賣:${formatEpochMs(event.opensAt)}", style = MaterialTheme.typography.bodyMedium)
            Text("截止:${formatEpochMs(event.deadlineAt)}", style = MaterialTheme.typography.bodyMedium)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                Text(
                    "剩餘 ${event.remainingSeats} 席",
                    style = MaterialTheme.typography.labelLarge,
                    color = if (event.remainingSeats == 0) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}
