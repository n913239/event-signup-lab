package com.example.eventreg.ui.orders

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.example.eventreg.api.models.OrderStatus

@Composable
fun OrderStatusLabel(status: OrderStatus, modifier: Modifier = Modifier) {
    val (text, color) = when (status.value) {
        "confirmed" -> "已確認" to MaterialTheme.colorScheme.primary
        "checked_in" -> "已入場" to Color(0xFF2E7D32)
        "cancelled" -> "已取消" to MaterialTheme.colorScheme.error
        else -> status.value to MaterialTheme.colorScheme.onSurfaceVariant
    }
    Text(text, color = color, style = MaterialTheme.typography.labelLarge, modifier = modifier)
}
