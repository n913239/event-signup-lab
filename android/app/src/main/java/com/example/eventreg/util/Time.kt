package com.example.eventreg.util

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** 活動在台灣舉辦,時間固定以台北時區顯示,不受裝置(或模擬器預設 UTC)時區影響。 */
private val EVENT_ZONE: ZoneId = ZoneId.of("Asia/Taipei")

private val DATE_TIME: DateTimeFormatter =
    DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm", Locale.ROOT).withZone(EVENT_ZONE)

/** API 時間一律是 epoch 毫秒。 */
fun formatEpochMs(epochMs: Long): String = DATE_TIME.format(Instant.ofEpochMilli(epochMs))
