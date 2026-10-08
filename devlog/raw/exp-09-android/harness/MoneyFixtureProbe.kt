package exp

import com.example.eventreg.util.formatCents
import java.io.File
import java.util.Locale
import org.junit.Test

/** exp-09 量測(不是 AI 寫的):web 與 iOS 共用的 14 組向量,預設語系與 de_DE 各跑一次。 */
class MoneyFixtureProbe {
    private val cases = Regex("""\{\s*"cents":\s*(-?\d+),\s*"text":\s*"([^"]+)"\s*\}""")
        .findAll(File("src/test/money-format.json").readText()).map { it.groupValues[1].toLong() to it.groupValues[2] }.toList()

    private fun run(locale: Locale) {
        val saved = Locale.getDefault(); Locale.setDefault(locale)
        var ok = 0
        for ((c, want) in cases) { val got = formatCents(c); if (got == want) ok++ else println("PROBE|$locale|✗ $c: got $got want $want") }
        println("PROBE|$locale|${ok}/${cases.size} 相同")
        Locale.setDefault(saved)
    }
    @Test fun fixture() { run(Locale.TAIWAN); run(Locale.GERMANY) }
}
