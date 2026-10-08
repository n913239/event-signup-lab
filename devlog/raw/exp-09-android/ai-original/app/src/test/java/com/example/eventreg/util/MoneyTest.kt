package com.example.eventreg.util

import org.junit.Assert.assertEquals
import org.junit.Test

class MoneyTest {
    @Test fun formatsExample() = assertEquals("NT$4,444.20", formatCents(444420))
    @Test fun zero() = assertEquals("NT$0.00", formatCents(0))
    @Test fun singleCent() = assertEquals("NT$0.05", formatCents(5))
    @Test fun noGroupingBelowThousand() = assertEquals("NT$999.99", formatCents(99999))
    @Test fun groupingAtThousand() = assertEquals("NT$1,000.00", formatCents(100000))
    @Test fun millions() = assertEquals("NT$1,234,567.89", formatCents(123456789))
    @Test fun longValues() = assertEquals("NT$92,233,720,368,547,758.07", formatCents(Long.MAX_VALUE))
    @Test fun negative() = assertEquals("-NT$1.50", formatCents(-150))
}
