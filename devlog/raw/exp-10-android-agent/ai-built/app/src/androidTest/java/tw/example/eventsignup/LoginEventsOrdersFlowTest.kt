package tw.example.eventsignup

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.printToLog
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * 端到端走一遍:登入 → 活動列表 → 座位圖 → 我的票券 → 票券明細。打真的後端。
 *
 * 帳密從 instrumentation arguments 讀:
 *   ./gradlew connectedDebugAndroidTest \
 *     -Pandroid.testInstrumentationRunnerArguments.DEMO_EMAIL=demo-buyer@example.com \
 *     -Pandroid.testInstrumentationRunnerArguments.DEMO_PASSWORD=password1
 */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class LoginEventsOrdersFlowTest {

    @get:Rule val compose = createEmptyComposeRule()

    private lateinit var scenario: ActivityScenario<MainActivity>
    private val app get() = ApplicationProvider.getApplicationContext<EventSignupApp>()

    private fun requiredArg(name: String): String {
        val value = InstrumentationRegistry.getArguments().getString(name)
        require(!value.isNullOrBlank()) { "缺少 instrumentation argument $name" }
        return value
    }

    @Before fun startLoggedOut() {
        app.sessionStore.clear()
        scenario = ActivityScenario.launch(MainActivity::class.java)
    }

    @After fun tearDown() {
        scenario.close()
        app.sessionStore.clear()
    }

    @Test fun loginThenBrowseEventsAndTickets() {
        val email = requiredArg("DEMO_EMAIL")
        val password = requiredArg("DEMO_PASSWORD")

        // 1. 登入
        compose.onNodeWithTag("login_email").performTextInput(email)
        compose.onNodeWithTag("login_password").performTextInput(password)
        compose.onNodeWithTag("login_submit").performClick()

        waitFor(hasTestTag("event_list") or hasTestTag("events_empty"))
        val session = app.sessionStore.current
        assertNotNull("登入後應保存 session", session)
        assertTrue(session!!.accessToken.isNotBlank())
        assertTrue(session.refreshToken.isNotBlank())

        // 2. 活動列表 → 座位圖
        assertTrue(
            "後端沒有 on_sale 的活動,無法驗證座位圖",
            compose.onAllNodesWithTag("event_item").fetchSemanticsNodes().isNotEmpty(),
        )
        compose.onAllNodesWithTag("event_item").onFirst().assertIsDisplayed().performClick()
        waitFor(hasTestTag("seat_map"))
        compose.onNodeWithTag("event_detail_name").assertIsDisplayed()
        compose.onNodeWithTag("seat_legend").assertIsDisplayed()

        val seats = compose.onAllNodes(tagStartsWith("seat_") and !hasTestTag("seat_map") and !hasTestTag("seat_legend"))
            .fetchSemanticsNodes()
        assertEquals("座位圖應為 10×10", 100, seats.size)
        val stateWords = setOf("空位", "保留中", "已售", "我的")
        seats.forEach { node ->
            val desc = node.config.getOrNull(SemanticsProperties.ContentDescription)?.firstOrNull().orEmpty()
            assertTrue("座位描述應帶狀態:$desc", desc.substringAfter(' ') in stateWords)
        }

        compose.onNodeWithTag("nav_back").performClick()
        waitFor(hasTestTag("event_list"))

        // 3. 我的票券 → 明細(示範帳號已有一張訂單)
        compose.onNodeWithTag("tab_orders").performClick()
        waitFor(hasTestTag("order_item"))
        // 卡片可點擊會合併子節點語意,金額的 tag 只在 unmerged tree 看得到
        val listTotal = compose.onAllNodesWithTag("order_item_total", useUnmergedTree = true)
            .onFirst().fetchSemanticsNode().text()
        assertTrue("金額格式應為 NT\$x,xxx.xx:$listTotal", MONEY.matches(listTotal))

        compose.onAllNodesWithTag("order_item").onFirst().performClick()
        waitFor(hasTestTag("order_detail_total"))
        compose.onNodeWithTag("order_detail_event").assertIsDisplayed()
        compose.onNodeWithTag("order_detail_status").assertIsDisplayed()
        compose.onNodeWithTag("order_detail_qr").assertIsDisplayed()
        val detailTexts = compose.onNodeWithTag("order_detail_total", useUnmergedTree = true)
            .fetchSemanticsNode().let { node -> node.children.map { it.text() } }
        assertTrue("明細總計應為金額格式:$detailTexts", detailTexts.any { MONEY.matches(it) })
    }

    /** 等不到時把畫面語意樹印到 logcat(tag: FlowTest),方便判斷卡在哪。 */
    private fun waitFor(matcher: SemanticsMatcher) {
        try {
            compose.waitUntilAtLeastOneExists(matcher, TIMEOUT)
        } catch (e: Throwable) {
            compose.onRoot().printToLog("FlowTest")
            throw e
        }
    }

    private fun tagStartsWith(prefix: String) = SemanticsMatcher("testTag starts with $prefix") {
        it.config.getOrNull(SemanticsProperties.TestTag)?.startsWith(prefix) == true
    }

    private fun androidx.compose.ui.semantics.SemanticsNode.text(): String =
        config.getOrNull(SemanticsProperties.Text)?.joinToString("") { it.text }.orEmpty()

    private companion object {
        const val TIMEOUT = 15_000L
        val MONEY = Regex("""NT\$\d{1,3}(,\d{3})*\.\d{2}""")
    }
}
