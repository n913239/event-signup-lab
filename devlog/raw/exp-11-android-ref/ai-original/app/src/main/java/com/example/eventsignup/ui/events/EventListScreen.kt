package com.example.eventsignup.ui.events

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
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
import com.example.eventsignup.api.apis.EventsApi
import com.example.eventsignup.api.models.EventStatus
import com.example.eventsignup.api.models.EventSummary
import com.example.eventsignup.ui.common.EmptyText
import com.example.eventsignup.ui.common.Loadable
import com.example.eventsignup.ui.common.LoadableContent
import com.example.eventsignup.ui.common.fetch
import com.example.eventsignup.ui.common.map
import com.example.eventsignup.util.Time

/** 活動列表(唯讀):GET /events?status=on_sale。 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventListScreen(api: EventsApi, onOpen: (String) -> Unit) {
    var reload by remember { mutableIntStateOf(0) }
    var state by remember { mutableStateOf<Loadable<List<EventSummary>>>(Loadable.Loading) }
    LaunchedEffect(reload) {
        state = Loadable.Loading
        state = fetch { api.listEvents(EventStatus.ON_SALE) }.map { it.events }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("活動") },
                actions = {
                    IconButton(onClick = { reload++ }) { Icon(Icons.Filled.Refresh, contentDescription = "重新整理") }
                },
            )
        },
    ) { padding ->
        LoadableContent(state, onRetry = { reload++ }, modifier = Modifier.padding(padding)) { events ->
            if (events.isEmpty()) {
                EmptyText("目前沒有開賣中的活動")
            } else {
                LazyColumn {
                    items(events, key = { it.id }) { e ->
                        ListItem(
                            headlineContent = { Text(e.name) },
                            supportingContent = {
                                Column {
                                    Text("開賣 ${Time.format(e.opensAt)}", style = MaterialTheme.typography.bodySmall)
                                    Text("截止 ${Time.format(e.deadlineAt)}", style = MaterialTheme.typography.bodySmall)
                                }
                            },
                            trailingContent = { Text("剩 ${e.remainingSeats} 席") },
                            modifier = Modifier.clickable { onOpen(e.id) }.testTag("event_row"),
                        )
                        HorizontalDivider()
                    }
                }
            }
        }
    }
}
