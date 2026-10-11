package com.example.eventsignup.util

import org.junit.Assert.assertEquals
import org.junit.Test

/** 跟 iOS Money.format 同一套規則;若拿得到 web/iOS 共用的 tests/fixtures/money-format.json,可改成讀那份。 */
class MoneyTest {
    @Test
    fun formatsCentsLikeOtherClients() {
        val cases = listOf(
            0L to "NT$0",
            5L to "NT$0.05",
            10L to "NT$0.10",
            99L to "NT$0.99",
            100L to "NT$1",
            101L to "NT$1.01",
            123_400L to "NT$1,234",
            444_420L to "NT$4,444.20",
            100_000L to "NT$1,000",
            99_999_999L to "NT$999,999.99",
            123_456_789L to "NT$1,234,567.89",
            100_000_000_00L to "NT$100,000,000",
            -444_420L to "-NT$4,444.20",
            -5L to "-NT$0.05",
        )
        for ((cents, text) in cases) assertEquals("$cents", text, Money.format(cents))
    }

    @Test
    fun intOverloadMatchesLong() {
        assertEquals(Money.format(444_420L), Money.format(444_420))
    }
}
