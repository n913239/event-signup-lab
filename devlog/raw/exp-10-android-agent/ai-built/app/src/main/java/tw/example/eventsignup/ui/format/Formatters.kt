package tw.example.eventsignup.ui.format

import tw.example.eventsignup.api.models.OrderStatus
import java.math.BigDecimal
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * 整數「分」→ `NT$4,444.20`。
 * 用 BigDecimal 移小數點,不經過 Double,避免浮點誤差;符號固定用 US 格式,不跟系統語系走。
 */
fun formatCents(cents: Long): String =
    DecimalFormat("NT$#,##0.00", DecimalFormatSymbols(Locale.US)).format(BigDecimal.valueOf(cents, 2))

fun formatCents(cents: Int): String = formatCents(cents.toLong())

private val dateTimeFormatter = DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm", Locale.TAIWAN)

/** epoch 毫秒 → `2026/10/08 19:30`(裝置時區) */
fun formatEpochMs(epochMs: Long, zone: ZoneId = ZoneId.systemDefault()): String =
    dateTimeFormatter.format(Instant.ofEpochMilli(epochMs).atZone(zone))

fun OrderStatus.label(): String = when (this) {
    OrderStatus.CONFIRMED -> "已確認"
    OrderStatus.CHECKED_IN -> "已入場"
    OrderStatus.CANCELLED -> "已取消"
}
