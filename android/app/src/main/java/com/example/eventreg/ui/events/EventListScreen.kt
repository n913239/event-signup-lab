package com.example.eventreg.ui.events

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.eventreg.api.models.EventSummary
import com.example.eventreg.api.models.ListEvents200Response
import com.example.eventreg.ui.common.EmptyMessage
import com.example.eventreg.ui.common.LoadStateContent
import com.example.eventreg.ui.common.LoaderViewModel
import com.example.eventreg.ui.common.MainTopBar
import com.example.eventreg.util.formatEpochMs

@Composable
fun EventListScreen(
    vm: LoaderViewModel<ListEvents200Response>,
    bottomBar: @Composable () -> Unit,
    onLogout: () -> Unit,
    onOpen: (String) -> Unit,
) {
    val state by vm.state.collectAsStateWithLifecycle()
    Scaffold(
        topBar = { MainTopBar("販售中活動", onRefresh = vm::reload, onLogout = onLogout) },
        bottomBar = bottomBar,
    ) { padding ->
        LoadStateContent(state, onRetry = vm::reload, modifier = Modifier.padding(padding)) { data ->
            if (data.events.isEmpty()) {
                EmptyMessage("目前沒有販售中的活動", tag = "events_empty")
            } else {
                LazyColumn(
                    Modifier.fillMaxSize().testTag("event_list"),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(data.events, key = { it.id }) { event ->
                        EventCard(event, serverNow = data.serverNow, onClick = { onOpen(event.id) })
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EventCard(event: EventSummary, serverNow: Long, onClick: () -> Unit) {
    // 「還沒開賣 / 已截止」用伺服器時間判斷,不信任裝置時鐘
    val phase = when {
        serverNow < event.opensAt -> "尚未開賣"
        serverNow >= event.deadlineAt -> "已截止"
        else -> null
    }
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth().testTag("event_item")) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(event.name, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                if (phase != null) {
                    Text(phase, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.tertiary)
                }
            }
            Text("開賣 ${formatEpochMs(event.opensAt)}", style = MaterialTheme.typography.bodyMedium)
            Text("截止 ${formatEpochMs(event.deadlineAt)}", style = MaterialTheme.typography.bodyMedium)
            Text(
                "剩餘 ${event.remainingSeats} 席",
                style = MaterialTheme.typography.bodyMedium,
                color = if (event.remainingSeats == 0) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
            )
        }
    }
}
