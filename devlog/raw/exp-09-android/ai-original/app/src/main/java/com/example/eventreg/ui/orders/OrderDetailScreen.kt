package com.example.eventreg.ui.orders

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.eventreg.api.models.Order
import com.example.eventreg.ui.common.BackTopBar
import com.example.eventreg.ui.common.InfoRow
import com.example.eventreg.ui.common.LoadStateContent
import com.example.eventreg.ui.common.LoaderViewModel
import com.example.eventreg.util.formatCents
import com.example.eventreg.util.formatEpochMs
import com.example.eventreg.util.sortSeatNos

@Composable
fun OrderDetailScreen(vm: LoaderViewModel<Order>, onBack: () -> Unit) {
    val state by vm.state.collectAsStateWithLifecycle()
    Scaffold(topBar = { BackTopBar("票券明細", onBack) }) { padding ->
        LoadStateContent(state, onRetry = vm::reload, modifier = Modifier.padding(padding)) { order ->
            OrderDetailContent(order)
        }
    }
}

@Composable
private fun OrderDetailContent(order: Order) {
    val itemsBySeat = order.items.associateBy { it.seatNo }
    val discountCents = order.subtotalCents - order.totalCents
    val promoCode = order.promoCode?.takeIf { it.isNotBlank() }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
            .testTag("order_detail"),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(order.eventName, style = MaterialTheme.typography.headlineSmall)
        OrderStatusLabel(order.status)
        InfoRow("訂單編號", order.id)
        InfoRow("確認時間", formatEpochMs(order.confirmedAt))

        HorizontalDivider()
        Text("座位", style = MaterialTheme.typography.titleMedium)
        sortSeatNos(itemsBySeat.keys).forEach { seatNo ->
            val item = itemsBySeat.getValue(seatNo)
            Row(Modifier.fillMaxWidth()) {
                Text(seatNo, modifier = Modifier.width(48.dp))
                Text(item.ticketTypeName, modifier = Modifier.weight(1f))
                Text(formatCents(item.unitPriceCents))
            }
        }

        HorizontalDivider()
        InfoRow("小計", formatCents(order.subtotalCents))
        if (promoCode != null) InfoRow("優惠碼", promoCode)
        if (discountCents > 0) InfoRow("折扣", "-" + formatCents(discountCents))
        InfoRow("總計", formatCents(order.totalCents), valueTag = "order_total", emphasize = true)

        HorizontalDivider()
        Text("入場憑證", style = MaterialTheme.typography.titleMedium)
        Text(order.qrPayload, fontFamily = FontFamily.Monospace, modifier = Modifier.testTag("order_qr"))
    }
}
