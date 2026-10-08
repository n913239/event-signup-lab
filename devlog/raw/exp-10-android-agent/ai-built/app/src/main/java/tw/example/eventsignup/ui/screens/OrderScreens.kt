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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import tw.example.eventsignup.api.models.Order
import tw.example.eventsignup.data.EventSignupRepository
import tw.example.eventsignup.ui.common.LoadableContent
import tw.example.eventsignup.ui.common.rememberLoad
import tw.example.eventsignup.ui.format.formatCents
import tw.example.eventsignup.ui.format.formatEpochMs
import tw.example.eventsignup.ui.format.label

@Composable
fun OrderListScreen(repository: EventSignupRepository, onOpen: (String) -> Unit) {
    val loaded = rememberLoad(Unit) { repository.listOrders() }
    LoadableContent(loaded) { orders ->
        if (orders.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("還沒有票券", modifier = Modifier.testTag("orders_empty"))
            }
        } else {
            LazyColumn(
                Modifier.fillMaxSize().testTag("order_list"),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(orders, key = { it.id }) { order -> OrderCard(order, onClick = { onOpen(order.id) }) }
            }
        }
    }
}

private fun Order.seatList(): String = items.joinToString("、") { it.seatNo }

@Composable
private fun OrderCard(order: Order, onClick: () -> Unit) {
    Card(Modifier.fillMaxWidth().clickable(onClick = onClick).testTag("order_item")) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(order.eventName, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                AssistChip(onClick = onClick, label = { Text(order.status.label()) })
            }
            Text("座號:${order.seatList()}")
            Text(
                formatCents(order.totalCents),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.testTag("order_item_total"),
            )
        }
    }
}

@Composable
fun OrderDetailScreen(repository: EventSignupRepository, orderId: String) {
    val loaded = rememberLoad(orderId) { repository.getOrder(orderId) }
    LoadableContent(loaded) { order -> OrderDetailContent(order) }
}

@Composable
private fun OrderDetailContent(order: Order) {
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(order.eventName, style = MaterialTheme.typography.titleLarge, modifier = Modifier.testTag("order_detail_event"))
        LabeledRow("狀態", order.status.label(), Modifier.testTag("order_detail_status"))
        LabeledRow("訂單編號", order.id)
        LabeledRow("成立時間", formatEpochMs(order.confirmedAt))

        HorizontalDivider()
        Text("座位", style = MaterialTheme.typography.titleSmall)
        order.items.forEach { item ->
            LabeledRow("${item.seatNo}  ${item.ticketTypeName}", formatCents(item.unitPriceCents))
        }

        HorizontalDivider()
        LabeledRow("小計", formatCents(order.subtotalCents))
        if (order.earlyBirdPct > 0) LabeledRow("早鳥折扣", "${order.earlyBirdPct}%")
        if (order.groupPct > 0) LabeledRow("團體折扣", "${order.groupPct}%")
        if (order.promoCode != null || order.promoCents > 0) {
            LabeledRow("優惠碼 ${order.promoCode.orEmpty()}".trim(), "-${formatCents(order.promoCents)}")
        }
        LabeledRow("總計", formatCents(order.totalCents), Modifier.testTag("order_detail_total"), emphasize = true)

        HorizontalDivider()
        Text("入場憑證", style = MaterialTheme.typography.titleSmall)
        SelectionContainer {
            Text(order.qrPayload, fontFamily = FontFamily.Monospace, modifier = Modifier.testTag("order_detail_qr"))
        }
    }
}

@Composable
private fun LabeledRow(label: String, value: String, modifier: Modifier = Modifier, emphasize: Boolean = false) {
    val style = if (emphasize) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyLarge
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = style, modifier = Modifier.padding(end = 16.dp))
        // 值(例如很長的訂單編號)佔剩餘寬度、靠右換行,不擠進標籤
        Text(
            value,
            style = style,
            fontWeight = if (emphasize) FontWeight.Bold else null,
            textAlign = TextAlign.End,
            modifier = Modifier.weight(1f),
        )
    }
}
