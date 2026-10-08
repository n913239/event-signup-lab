package tw.example.eventsignup.ui.format

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.ZoneId
import java.util.Locale

class FormattersTest {

    @Test fun `cents are shown as NT dollars with two decimals and grouping`() {
        assertEquals("NT$4,444.20", formatCents(444_420))
        assertEquals("NT$0.00", formatCents(0))
        assertEquals("NT$0.05", formatCents(5))
        assertEquals("NT$1.00", formatCents(100))
        assertEquals("NT$999.99", formatCents(99_999))
        assertEquals("NT$1,000.00", formatCents(100_000))
        assertEquals("NT$1,234,567.89", formatCents(123_456_789L))
    }

    @Test fun `negative cents keep the sign`() {
        assertEquals("-NT$12.34", formatCents(-1_234))
    }

    @Test fun `int and long overloads agree at the int boundary`() {
        assertEquals("NT$21,474,836.47", formatCents(Int.MAX_VALUE))
        assertEquals(formatCents(Int.MAX_VALUE.toLong()), formatCents(Int.MAX_VALUE))
    }

    @Test fun `format does not follow the device locale`() {
        val original = Locale.getDefault()
        try {
            Locale.setDefault(Locale.GERMANY) // 德文用 . 分千位、, 當小數點
            assertEquals("NT$4,444.20", formatCents(444_420))
        } finally {
            Locale.setDefault(original)
        }
    }

    @Test fun `epoch millis are formatted in the given zone`() {
        // 2026-10-08T11:30:00Z
        val ms = 1_791_459_000_000L
        assertEquals("2026/10/08 19:30", formatEpochMs(ms, ZoneId.of("Asia/Taipei")))
        assertEquals("2026/10/08 11:30", formatEpochMs(ms, ZoneId.of("UTC")))
    }
}
