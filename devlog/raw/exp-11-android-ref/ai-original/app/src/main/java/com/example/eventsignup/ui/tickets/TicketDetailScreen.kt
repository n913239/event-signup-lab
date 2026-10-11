package com.example.eventsignup.ui.tickets

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.example.eventsignup.api.apis.OrdersApi
import com.example.eventsignup.api.models.Order
import com.example.eventsignup.ui.common.BackButton
import com.example.eventsignup.ui.common.Loadable
import com.example.eventsignup.ui.common.LoadableContent
import com.example.eventsignup.ui.common.fetch
import com.example.eventsignup.util.Money
import com.example.eventsignup.util.Time
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter

/** 票券明細:GET /orders/{id},金額快照 + qr_payload 畫成 QR。 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TicketDetailScreen(api: OrdersApi, id: String, onBack: () -> Unit) {
    var reload by remember { mutableIntStateOf(0) }
    var state by remember { mutableStateOf<Loadable<Order>>(Loadable.Loading) }
    LaunchedEffect(id, reload) {
        state = Loadable.Loading
        state = fetch { api.getOrder(id) }
    }
    val title = (state as? Loadable.Ready)?.value?.eventName ?: "票券"

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                navigationIcon = { BackButton(onBack) },
            )
        },
    ) { padding ->
        LoadableContent(state, onRetry = { reload++ }, modifier = Modifier.padding(padding)) { o ->
            OrderDetail(o)
        }
    }
}

@Composable
private fun OrderDetail(o: Order) {
    Column(
        Modifier.verticalScroll(rememberScrollState()).padding(16.dp).fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text("狀態:${orderStatusLabel(o.status.value)}", modifier = Modifier.testTag("order_status"))
        Text("成立時間:${Time.format(o.confirmedAt)}", style = MaterialTheme.typography.bodySmall)
        HorizontalDivider()

        o.items.forEach { item ->
            AmountRow("${item.seatNo}  ${item.ticketTypeName}", Money.format(item.unitPriceCents))
        }
        HorizontalDivider()

        AmountRow("小計", Money.format(o.subtotalCents))
        if (o.earlyBirdPct > 0) AmountRow("早鳥折扣", "${o.earlyBirdPct}%")
        if (o.groupPct > 0) AmountRow("團體折扣", "${o.groupPct}%")
        o.promoCode?.let { AmountRow("優惠碼 $it", "−${Money.format(o.promoCents)}") }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("總計", fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Text(Money.format(o.totalCents), fontWeight = FontWeight.Bold, modifier = Modifier.testTag("order_total"))
        }

        val qr = remember(o.qrPayload) { qrBitmap(o.qrPayload) }
        if (qr != null) {
            Image(
                bitmap = qr,
                contentDescription = "入場 QR code",
                filterQuality = FilterQuality.None,
                modifier = Modifier.padding(top = 16.dp).size(220.dp).align(Alignment.CenterHorizontally),
            )
        }
        Text(
            o.qrPayload,
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.align(Alignment.CenterHorizontally),
        )
    }
}

@Composable
private fun AmountRow(label: String, amount: String) {
    Row(Modifier.fillMaxWidth()) {
        Text(label, modifier = Modifier.weight(1f))
        Text(amount)
    }
}

private fun qrBitmap(text: String, size: Int = 512): ImageBitmap? {
    if (text.isEmpty()) return null
    return runCatching {
        val m = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, size, size, mapOf(EncodeHintType.MARGIN to 1))
        val pixels = IntArray(size * size) { i -> if (m.get(i % size, i / size)) 0xFF000000.toInt() else 0xFFFFFFFF.toInt() }
        Bitmap.createBitmap(pixels, size, size, Bitmap.Config.ARGB_8888).asImageBitmap()
    }.getOrNull()
}
