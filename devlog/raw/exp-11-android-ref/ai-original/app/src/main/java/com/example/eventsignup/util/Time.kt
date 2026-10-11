package com.example.eventsignup.util

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** 時間一律 epoch 毫秒;用裝置時區顯示。 */
object Time {
    private val formatter = DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm")

    fun format(epochMs: Long, zone: ZoneId = ZoneId.systemDefault()): String =
        formatter.withZone(zone).format(Instant.ofEpochMilli(epochMs))
}
