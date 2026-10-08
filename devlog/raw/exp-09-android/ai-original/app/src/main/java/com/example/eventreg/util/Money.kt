package com.example.eventreg.util

import kotlin.math.abs

/**
 * 金額在 API 一律是整數「分」(*_cents),只在顯示時轉成 `NT$4,444.20`。
 * 全程整數運算:不經過 Double(避免捨入誤差),也不吃裝置 locale(避免小數點變逗號)。
 */
fun formatCents(cents: Long): String {
    val sign = if (cents < 0) "-" else ""
    val dollars = abs(cents / 100)
    val fraction = abs(cents % 100)
    return sign + "NT$" + groupThousands(dollars) + "." + fraction.toString().padStart(2, '0')
}

fun formatCents(cents: Int): String = formatCents(cents.toLong())

private fun groupThousands(value: Long): String {
    val digits = value.toString()
    val out = StringBuilder(digits.length + digits.length / 3)
    digits.forEachIndexed { i, ch ->
        if (i > 0 && (digits.length - i) % 3 == 0) out.append(',')
        out.append(ch)
    }
    return out.toString()
}
