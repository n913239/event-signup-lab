package com.example.eventreg

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * 端到端走一遍:登入 → 活動列表 → 座位圖 → 我的票券 → 票券明細。
 * 打真的後端(BuildConfig.API_BASE_URL),帳密從 instrumentation arguments 讀:
 *   -Pandroid.testInstrumentationRunnerArguments.DEMO_EMAIL=...
 *   -Pandroid.testInstrumentationRunnerArguments.DEMO_PASSWORD=...
 */
@RunWith(AndroidJUnit4::class)
class DemoFlowTest {

    @get:Rule
    val compose = createEmptyComposeRule()

    private lateinit var scenario: ActivityScenario<MainActivity>

    @Before
    fun setUp() {
        // 從登出狀態開始;Application 早已建立,所以要清 container 裡那份 TokenStore
        ApplicationProvider.getApplicationContext<EventRegApp>().container.tokenStore.clear()
        scenario = ActivityScenario.launch(MainActivity::class.java)
    }

    @After
    fun tearDown() {
        scenario.close()
    }

    @Test
    fun login_thenEventSeatMap_thenTickets() {
        val email = requireArg("DEMO_EMAIL")
        val password = requireArg("DEMO_PASSWORD")

        // 1. 登入
        compose.onNodeWithTag("login_email").performTextInput(email)
        compose.onNodeWithTag("login_password").performTextInput(password)
        compose.onNodeWithTag("login_submit").performClick()

        // 2. 活動列表 → 座位圖
        when (val found = waitForAny("event_item", "events_empty", "error", "login_error")) {
            "event_item" -> Unit
            "events_empty" -> fail("後端沒有 on_sale 活動,無法驗證座位圖;請先建立 demo 活動")
            else -> fail("登入或載入活動失敗:${textOf(found)}")
        }
        compose.onAllNodesWithTag("event_item").onFirst().performClick()

        when (val found = waitForAny("seat_grid", "error")) {
            "error" -> fail("載入活動詳情失敗:${textOf(found)}")
        }
        for (row in 'A'..'J') {
            for (col in 1..10) compose.onNodeWithTag("seat_$row$col").assertExists()
        }

        compose.onNodeWithTag("nav_back").performClick()
        waitForAny("event_list")

        // 3. 我的票券 → 明細
        compose.onNodeWithTag("tab_orders").performClick()
        when (val found = waitForAny("order_item", "orders_empty", "error")) {
            "error" -> fail("載入票券失敗:${textOf(found)}")
            "orders_empty" -> {
                // demo 帳號沒有訂單時,至少確認空狀態畫面正常
                compose.onNodeWithTag("orders_empty").assertIsDisplayed()
                return
            }
        }
        compose.onAllNodesWithTag("order_item").onFirst().performClick()

        when (val found = waitForAny("order_detail", "error")) {
            "error" -> fail("載入票券明細失敗:${textOf(found)}")
        }
        compose.onNodeWithTag("order_total").assertTextContains("NT$", substring = true)
        compose.onNodeWithTag("order_qr").assertExists()
    }

    private fun requireArg(name: String): String =
        InstrumentationRegistry.getArguments().getString(name)?.takeIf { it.isNotEmpty() }
            ?: error("缺少 instrumentation argument $name;用 -Pandroid.testInstrumentationRunnerArguments.$name=... 傳入")

    /** 等到任一 tag 出現(打真網路,給寬一點的時間),回傳出現的那個。 */
    private fun waitForAny(vararg tags: String, timeoutMillis: Long = 20_000): String {
        var found: String? = null
        compose.waitUntil(timeoutMillis) {
            found = tags.firstOrNull { tag ->
                compose.onAllNodesWithTag(tag).fetchSemanticsNodes(atLeastOneRootRequired = false).isNotEmpty()
            }
            found != null
        }
        return found!!
    }

    private fun textOf(tag: String): String =
        compose.onNodeWithTag(tag).fetchSemanticsNode().config
            .getOrNull(SemanticsProperties.Text)
            ?.joinToString { it.text }
            .orEmpty()
}
