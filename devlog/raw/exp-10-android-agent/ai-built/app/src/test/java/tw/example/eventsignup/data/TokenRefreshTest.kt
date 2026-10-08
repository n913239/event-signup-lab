package tw.example.eventsignup.data

import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import tw.example.eventsignup.api.infrastructure.ClientException
import tw.example.eventsignup.api.models.OrderStatus

/** 用 MockWebServer 驗:產生的 client 能解析契約裡的 JSON,以及 401 → refresh → 重送 的流程。 */
class TokenRefreshTest {

    private class MemoryPersistence(var stored: Session? = null) : SessionPersistence {
        override fun load() = stored
        override fun save(session: Session?) { stored = session }
    }

    private lateinit var server: MockWebServer
    private lateinit var persistence: MemoryPersistence
    private lateinit var store: SessionStore
    private lateinit var repo: EventSignupRepository

    @Before fun setUp() {
        server = MockWebServer().apply { start() }
        persistence = MemoryPersistence()
        store = SessionStore(persistence)
        repo = EventSignupRepository(server.url("/").toString().trimEnd('/'), store)
    }

    @After fun tearDown() = server.shutdown()

    private fun json(code: Int, body: String) =
        MockResponse().setResponseCode(code).setHeader("Content-Type", "application/json").setBody(body)

    private fun tokenPair(access: String, refresh: String) = """
        {"access_token":"$access","refresh_token":"$refresh","expires_at":1791459900000,
         "member":{"id":"m1","email":"demo@example.com","nickname":"Demo","role":"member"}}
    """.trimIndent()

    private val ordersBody = """
        {"orders":[{"id":"o1","event_id":"e1","event_name":"Kotlin Conf","member_id":"m1","status":"confirmed",
          "items":[{"seat_no":"A10","ticket_type_id":"t1","ticket_type_name":"一般","unit_price_cents":444420}],
          "subtotal_cents":444420,"early_bird_pct":0,"group_pct":0,"promo_code":null,"promo_cents":0,
          "total_cents":444420,"confirmed_at":1791459000000,"qr_payload":"o1.abcdefghijklmnopqrstuv"}],
         "server_now":1791459000000}
    """.trimIndent()

    @Test fun `login stores both tokens`() = runBlocking {
        server.enqueue(json(200, tokenPair("acc-1", "ref-1")))

        repo.login("demo@example.com", "password1")

        assertEquals("acc-1", persistence.stored?.accessToken)
        assertEquals("ref-1", persistence.stored?.refreshToken)
        val req = server.takeRequest()
        assertEquals("/auth/login", req.path)
        assertNull("login 不該帶 Authorization", req.getHeader("Authorization"))
    }

    @Test fun `expired access token is refreshed once and the request retried`() = runBlocking {
        store.save(Session("old-acc", "ref-1", 0, "demo@example.com"))
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse = when {
                request.path == "/auth/refresh" -> json(200, tokenPair("new-acc", "ref-2"))
                request.getHeader("Authorization") == "Bearer new-acc" -> json(200, ordersBody)
                else -> json(401, """{"error":"unauthorized"}""")
            }
        }

        val orders = repo.listOrders()

        assertEquals(1, orders.size)
        assertEquals(OrderStatus.CONFIRMED, orders[0].status)
        assertEquals(444420, orders[0].totalCents)
        assertNull(orders[0].promoCode)
        assertEquals("new-acc", persistence.stored?.accessToken)
        assertEquals("ref-2", persistence.stored?.refreshToken)

        val paths = List(server.requestCount) { server.takeRequest().path }
        assertEquals(listOf("/orders", "/auth/refresh", "/orders"), paths)
    }

    @Test fun `rejected refresh clears the session`() = runBlocking {
        store.save(Session("old-acc", "ref-1", 0, "demo@example.com"))
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest) = json(401, """{"error":"refresh_replayed"}""")
        }

        try {
            repo.listOrders()
            fail("expected 401")
        } catch (e: ClientException) {
            assertEquals(401, e.statusCode)
        }
        assertNull(store.current)
        assertNull(persistence.stored)
    }

    @Test fun `event detail with null my_hold and 100 seats parses`() = runBlocking {
        store.save(Session("acc", "ref", 0, "demo@example.com"))
        val seats = ('A'..'J').flatMap { r -> (1..10).map { c -> "$r$c" } }
            .joinToString(",") { """{"seat_no":"$it","state":"${if (it == "A1") "mine" else "free"}","ticket_type_id":null}""" }
        server.enqueue(json(200, """
            {"id":"e1","name":"Kotlin Conf","status":"on_sale","opens_at":1791459000000,"deadline_at":1791545400000,
             "remaining_seats":99,"owner_id":"s1","group_min_qty":4,"group_pct":10,"hold_ttl_minutes":10,
             "ticket_types":[{"id":"t1","event_id":"e1","name":"一般","price_cents":444420,"capacity":100,"remaining":99,
               "early_bird_until":null,"early_bird_pct":0}],
             "seats":[$seats],"my_hold":null,"server_now":1791459000000}
        """.trimIndent()))

        val detail = repo.getEvent("e1")

        assertEquals(100, detail.seats.size)
        assertNull(detail.myHold)
        assertTrue(detail.seats.first { it.seatNo == "A1" }.state.name == "MINE")
        assertEquals("Bearer acc", server.takeRequest().getHeader("Authorization"))
    }
}
