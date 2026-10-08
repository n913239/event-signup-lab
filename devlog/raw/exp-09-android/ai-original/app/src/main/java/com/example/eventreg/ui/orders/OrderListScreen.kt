package com.example.eventreg.ui.orders

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
import com.example.eventreg.api.models.Order
import com.example.eventreg.ui.common.EmptyMessage
import com.example.eventreg.ui.common.LoadStateContent
import com.example.eventreg.ui.common.LoaderViewModel
import com.example.eventreg.ui.common.MainTopBar
import com.example.eventreg.util.formatCents
import com.example.eventreg.util.sortSeatNos

@Composable
fun OrderListScreen(
    vm: LoaderViewModel<List<Order>>,
    bottomBar: @Composable () -> Unit,
    onLogout: () -> Unit,
    onOpen: (String) -> Unit,
) {
    val state by vm.state.collectAsStateWithLifecycle()
    Scaffold(
        topBar = { MainTopBar("我的票券", onRefresh = vm::reload, onLogout = onLogout) },
        bottomBar = bottomBar,
    ) { padding ->
        LoadStateContent(state, onRetry = vm::reload, modifier = Modifier.padding(padding)) { orders ->
            if (orders.isEmpty()) {
                EmptyMessage("還沒有票券", tag = "orders_empty")
            } else {
                LazyColumn(
                    Modifier.fillMaxSize().testTag("order_list"),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(orders, key = { it.id }) { order ->
                        OrderCard(order, onClick = { onOpen(order.id) })
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OrderCard(order: Order, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth().testTag("order_item")) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(order.eventName, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                OrderStatusLabel(order.status)
            }
            Text(
                "座號 " + sortSeatNos(order.items.map { it.seatNo }).joinToString("、"),
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(formatCents(order.totalCents), style = MaterialTheme.typography.titleSmall)
        }
    }
}
