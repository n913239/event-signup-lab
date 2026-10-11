package com.example.eventsignup.ui.tickets

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import com.example.eventsignup.api.apis.OrdersApi
import com.example.eventsignup.api.models.Order
import com.example.eventsignup.auth.Session
import com.example.eventsignup.ui.common.EmptyText
import com.example.eventsignup.ui.common.Loadable
import com.example.eventsignup.ui.common.LoadableContent
import com.example.eventsignup.ui.common.fetch
import com.example.eventsignup.ui.common.map
import com.example.eventsignup.util.Money
import kotlinx.coroutines.launch

/** 我的票券:GET /orders。 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TicketListScreen(api: OrdersApi, session: Session, onOpen: (String) -> Unit) {
    var reload by remember { mutableIntStateOf(0) }
    var state by remember { mutableStateOf<Loadable<List<Order>>>(Loadable.Loading) }
    var loggingOut by remember { mutableStateOf(false) }
    var logoutFailed by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(reload) {
        state = Loadable.Loading
        state = fetch { api.listOrders() }.map { it.orders }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("我的票券") },
                actions = {
                    IconButton(onClick = { reload++ }) { Icon(Icons.Filled.Refresh, contentDescription = "重新整理") }
                    TextButton(
                        enabled = !loggingOut,
                        onClick = {
                            loggingOut = true
                            scope.launch {
                                logoutFailed = !session.logout()
                                loggingOut = false
                            }
                        },
                        modifier = Modifier.testTag("logout"),
                    ) { Text("登出") }
                },
            )
        },
    ) { padding ->
        LoadableContent(state, onRetry = { reload++ }, modifier = Modifier.padding(padding)) { orders ->
            if (orders.isEmpty()) {
                EmptyText("還沒有票券")
            } else {
                LazyColumn {
                    items(orders, key = { it.id }) { o ->
                        ListItem(
                            headlineContent = { Text(o.eventName) },
                            supportingContent = { Text(o.items.joinToString("、") { it.seatNo }) },
                            trailingContent = { Text("${Money.format(o.totalCents)}\n${orderStatusLabel(o.status.value)}") },
                            modifier = Modifier.clickable { onOpen(o.id) }.testTag("order_row"),
                        )
                        HorizontalDivider()
                    }
                }
            }
        }
    }

    if (logoutFailed) {
        AlertDialog(
            onDismissRequest = { logoutFailed = false },
            confirmButton = { TextButton(onClick = { logoutFailed = false }) { Text("好") } },
            title = { Text("登出需要連線") },
            text = { Text("連上網路後再登出一次,伺服器才會撤銷這台裝置的登入。") },
        )
    }
}

fun orderStatusLabel(value: String): String = when (value) {
    "confirmed" -> "已確認"
    "checked_in" -> "已入場"
    "cancelled" -> "已取消"
    else -> value
}
