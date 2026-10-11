package com.example.eventsignup

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * 模擬器接真的後端走一遍三畫面:登入 → 活動(含座位圖)→ 票券(含明細)。對應 iOS 的 LiveWalkthroughTests。
 *
 * 帳密從 instrumentation arguments 來,沒給就跳過,不進版控:
 *   ./gradlew connectedDebugAndroidTest \
 *     -Pandroid.testInstrumentationRunnerArguments.DEMO_EMAIL=... \
 *     -Pandroid.testInstrumentationRunnerArguments.DEMO_PASSWORD=...
 *
 * 前提:示範帳號至少看得到一個 on_sale 活動、至少有一張訂單。
 * 斷言都是「等到真的有資料列出現」,不是「沒看到錯誤」—— 列表載入被拿掉、畫面全空時要會紅。
 */
@RunWith(AndroidJUnit4::class)
class WalkthroughTest {
    @get:Rule
    val compose = createEmptyComposeRule()

    @Test
    fun loginEventsTickets() {
        val args = InstrumentationRegistry.getArguments()
        val email = args.getString("DEMO_EMAIL")
        val password = args.getString("DEMO_PASSWORD")
        assumeTrue("沒給 DEMO_EMAIL / DEMO_PASSWORD", !email.isNullOrBlank() && !password.isNullOrBlank())

        ActivityScenario.launch(MainActivity::class.java).use {
            // 上次跑留下的 token 還在時,App 一開就是已登入:先從票券頁登出(順便走一次線上登出)
            compose.waitUntil(10_000) { compose.exists("login") || compose.exists("tab_tickets") }
            if (compose.exists("tab_tickets")) {
                compose.onNodeWithTag("tab_tickets").performClick()
                compose.waitUntil(10_000) { compose.exists("logout") }
                compose.onNodeWithTag("logout").performClick()
                compose.waitUntil(20_000) { compose.exists("login") }
            }

            // 1. 登入
            compose.onNodeWithTag("email").performTextInput(email!!)
            compose.onNodeWithTag("password").performTextInput(password!!)
            compose.onNodeWithTag("login").performClick()

            // 2. 活動列表 → 座位圖
            compose.waitUntil(20_000) { compose.exists("event_row") || compose.exists("login_error") }
            assertTrue("登入失敗或活動列表是空的 —— GET /events 沒回來", compose.exists("event_row"))
            compose.onAllNodesWithTag("event_row").onFirst().performClick()

            compose.waitUntil(20_000) { compose.exists("seat_grid") }
            compose.onAllNodes(tagStartsWith("seat_") and !hasTag("seat_grid")).assertCountEquals(100)
            compose.onNodeWithTag("seat_A1").assertIsDisplayed()
            compose.onNodeWithTag("back").performClick()

            // 3. 我的票券 → 明細
            compose.onNodeWithTag("tab_tickets").performClick()
            compose.waitUntil(20_000) { compose.exists("order_row") }
            compose.onAllNodesWithTag("order_row").onFirst().performClick()

            compose.waitUntil(20_000) { compose.exists("order_total") }
            compose.onNodeWithTag("order_total").assertTextContains("NT$", substring = true)
        }
    }

    private fun ComposeTestRule.exists(tag: String) =
        onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()

    private fun tagStartsWith(prefix: String) = SemanticsMatcher("testTag starts with $prefix") {
        it.config.getOrNull(SemanticsProperties.TestTag)?.startsWith(prefix) == true
    }

    private fun hasTag(tag: String) = SemanticsMatcher.expectValue(SemanticsProperties.TestTag, tag)
}
