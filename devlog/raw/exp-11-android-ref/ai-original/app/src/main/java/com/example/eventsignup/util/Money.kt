package com.example.eventsignup.util

/**
 * Android 唯一做「分 → 元」的地方,跟 iOS 的 Money.format 逐字相同。
 * 整數運算拆商與餘數,不經過 Double;千分位固定用逗號自己拆 —— 不用 NumberFormat,
 * 它跟裝置語系走(de_DE 會變句點),同一筆金額在各端會長得不一樣。
 *
 *   444420 → NT$4,444.20    100 → NT$1    5 → NT$0.05
 */
object Money {
    fun format(cents: Long): String {
        val sign = if (cents < 0) "-" else ""
        val abs = if (cents < 0) -cents else cents
        val yuan = abs / 100
        val rest = abs % 100
        val head = "${sign}NT\$${grouped(yuan)}"
        return if (rest == 0L) head else head + "." + rest.toString().padStart(2, '0')
    }

    fun format(cents: Int): String = format(cents.toLong())

    internal fun grouped(n: Long): String {
        val digits = n.toString()
        val out = StringBuilder()
        digits.forEachIndexed { i, d ->
            if (i > 0 && (digits.length - i) % 3 == 0) out.append(',')
            out.append(d)
        }
        return out.toString()
    }
}
