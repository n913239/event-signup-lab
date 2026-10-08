package exp

import android.graphics.Bitmap
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import com.google.android.apps.common.testing.accessibility.framework.AccessibilityCheckPreset
import com.google.android.apps.common.testing.accessibility.framework.AccessibilityCheckResult.AccessibilityCheckResultType
import com.google.android.apps.common.testing.accessibility.framework.integrations.espresso.AccessibilityValidator
import java.util.Locale
import androidx.compose.ui.test.filterToOne
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.example.eventreg.EventRegApp
import com.example.eventreg.MainActivity
import java.io.File
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** exp-09 量測(不是 AI 寫的):五個畫面各跑一次 Compose 無障礙檢查(ATF)並截圖。問題只記錄、不讓測試失敗。 */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class EnvAudit {
    @get:Rule val compose = createEmptyComposeRule()
    private val args = InstrumentationRegistry.getArguments()
    private val mode = args.getString("AUDIT_MODE") ?: "default"

    private lateinit var scenario: ActivityScenario<MainActivity>

    @Test fun auditFiveScreens() {
        ApplicationProvider.getApplicationContext<EventRegApp>().container.tokenStore.clear()
        val sc = ActivityScenario.launch(MainActivity::class.java)
        scenario = sc
        waitFor("login_email"); audit("1-login")
        compose.onNodeWithTag("login_email").performTextInput(args.getString("DEMO_EMAIL")!!)
        compose.onNodeWithTag("login_password").performTextInput(args.getString("DEMO_PASSWORD")!!)
        compose.onNodeWithTag("login_submit").performClick()
        waitFor("event_item"); audit("2-events")
        compose.onAllNodesWithTag("event_item").filterToOne(hasText("示範活動", substring = true)).performClick()
        waitFor("seat_grid"); audit("3-seats")
        compose.onNodeWithTag("nav_back").performClick()
        waitFor("event_list"); compose.onNodeWithTag("tab_orders").performClick()
        waitFor("order_item"); audit("4-tickets")
        compose.onAllNodesWithTag("order_item").onFirst().performClick()
        waitFor("order_detail"); audit("5-ticket-detail")
        sc.close()
    }

    private fun waitFor(tag: String) = compose.waitUntil(20_000) {
        compose.onAllNodesWithTag(tag, useUnmergedTree = true).fetchSemanticsNodes(atLeastOneRootRequired = false).isNotEmpty()
    }

    private fun audit(screen: String) {
        compose.waitForIdle(); Thread.sleep(800)
        val ins = InstrumentationRegistry.getInstrumentation()
        val dir = File(ins.targetContext.getExternalFilesDir(null), "audit").apply { mkdirs() }
        ins.uiAutomation.takeScreenshot()?.let { File(dir, "$mode-$screen.png").outputStream().use { o -> it.compress(Bitmap.CompressFormat.PNG, 100, o) } }
        val v = AccessibilityValidator().setCheckPreset(AccessibilityCheckPreset.LATEST)
            .setRunChecksFromRootView(true).setCaptureScreenshots(true).setThrowExceptionForErrors(false)
        var n = 0
        scenario.onActivity { act ->
            for (r in v.checkAndReturnResults(act.window.decorView)) {
                if (r.type != AccessibilityCheckResultType.ERROR && r.type != AccessibilityCheckResultType.WARNING) continue
                n++
                println("AUDIT|$mode|$screen|${r.type}|${r.sourceCheckClass.simpleName}|${r.getMessage(Locale.TRADITIONAL_CHINESE).toString().replace('\n',' ')}")
            }
        }
        println("AUDITCOUNT|$mode|$screen|$n")
    }
}
