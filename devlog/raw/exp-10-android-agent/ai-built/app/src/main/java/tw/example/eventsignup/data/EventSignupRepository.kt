package tw.example.eventsignup.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import tw.example.eventsignup.api.apis.AuthApi
import tw.example.eventsignup.api.apis.EventsApi
import tw.example.eventsignup.api.apis.OrdersApi
import tw.example.eventsignup.api.infrastructure.ClientException
import tw.example.eventsignup.api.infrastructure.ServerException
import tw.example.eventsignup.api.models.EventDetail
import tw.example.eventsignup.api.models.EventStatus
import tw.example.eventsignup.api.models.EventSummary
import tw.example.eventsignup.api.models.LoginRequest
import tw.example.eventsignup.api.models.Order
import tw.example.eventsignup.api.models.RefreshRequest
import java.io.IOException
import java.util.concurrent.TimeUnit

/** 包住 OpenAPI 產生的 client:切到 IO thread、處理 token。 */
class EventSignupRepository(
    baseUrl: String,
    private val sessionStore: SessionStore,
    debugLogging: Boolean = false,
) {
    private val baseClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .apply {
            // BASIC 只記方法、網址、狀態碼,不會把 token 寫進 log
            if (debugLogging) addInterceptor(HttpLoggingInterceptor().setLevel(HttpLoggingInterceptor.Level.BASIC))
        }
        .build()

    /** 不帶 token、不會自動 refresh:給 login / refresh / logout 用 */
    private val authApi = AuthApi(baseUrl, baseClient)

    private val authedClient = baseClient.newBuilder()
        .addInterceptor(AuthInterceptor(sessionStore))
        .authenticator(TokenAuthenticator(sessionStore) { authApi.refresh(it) })
        .build()

    private val eventsApi = EventsApi(baseUrl, authedClient)
    private val ordersApi = OrdersApi(baseUrl, authedClient)

    suspend fun login(email: String, password: String) = io {
        val pair = authApi.login(LoginRequest(email = email, password = password))
        sessionStore.save(pair.toSession(email))
    }

    suspend fun logout() {
        val refreshToken = sessionStore.current?.refreshToken
        sessionStore.clear()
        if (refreshToken != null) {
            // 盡力撤銷伺服器端的 refresh;失敗也不影響本機登出
            runCatching { io { authApi.logout(RefreshRequest(refreshToken)) } }
        }
    }

    suspend fun listOnSaleEvents(): List<EventSummary> = io { eventsApi.listEvents(EventStatus.ON_SALE).events }

    suspend fun getEvent(id: String): EventDetail = io { eventsApi.getEvent(id) }

    suspend fun listOrders(): List<Order> = io { ordersApi.listOrders().orders }

    suspend fun getOrder(id: String): Order = io { ordersApi.getOrder(id) }

    private suspend fun <T> io(block: () -> T): T = withContext(Dispatchers.IO) { block() }
}

/** 把例外轉成給使用者看的訊息。 */
fun Throwable.toUserMessage(): String = when (this) {
    is ClientException -> when (statusCode) {
        400 -> "輸入格式不正確"
        401 -> "帳號或密碼錯誤,或登入已過期"
        403 -> "沒有權限"
        404 -> "找不到資料"
        else -> "請求失敗($statusCode)"
    }
    is ServerException -> "伺服器錯誤($statusCode),請稍後再試"
    is IOException -> "無法連線到伺服器"
    else -> "發生錯誤:${message ?: javaClass.simpleName}"
}
