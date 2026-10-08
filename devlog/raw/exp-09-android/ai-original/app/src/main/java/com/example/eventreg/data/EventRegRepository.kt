package com.example.eventreg.data

import com.example.eventreg.api.apis.AuthApi
import com.example.eventreg.api.apis.EventsApi
import com.example.eventreg.api.apis.OrdersApi
import com.example.eventreg.api.models.EventDetail
import com.example.eventreg.api.models.EventStatus
import com.example.eventreg.api.models.ListEvents200Response
import com.example.eventreg.api.models.LoginRequest
import com.example.eventreg.api.models.LogoutRequest
import com.example.eventreg.api.models.Order
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** 產生的 client 是同步呼叫(OkHttp execute),這裡統一切到 IO 執行緒。 */
class EventRegRepository(
    private val tokenStore: TokenStore,
    private val authApi: AuthApi,
    private val eventsApi: EventsApi,
    private val ordersApi: OrdersApi,
    private val revokeApi: (accessToken: String) -> AuthApi,
    private val appScope: CoroutineScope,
) {
    suspend fun login(email: String, password: String) = withContext(Dispatchers.IO) {
        tokenStore.save(authApi.login(LoginRequest(email = email, password = password)))
    }

    suspend fun onSaleEvents(): ListEvents200Response = withContext(Dispatchers.IO) {
        eventsApi.listEvents(EventStatus.ON_SALE)
    }

    suspend fun event(id: String): EventDetail = withContext(Dispatchers.IO) {
        eventsApi.getEvent(id)
    }

    suspend fun orders(): List<Order> = withContext(Dispatchers.IO) {
        ordersApi.listOrders().orders.sortedByDescending { it.confirmedAt }
    }

    suspend fun order(id: String): Order = withContext(Dispatchers.IO) {
        ordersApi.getOrder(id)
    }

    /** 本機立刻登出;伺服器端撤銷 refresh 在背景盡力而為,失敗也不擋使用者。 */
    fun logout() {
        val access = tokenStore.accessToken
        val refresh = tokenStore.refreshToken
        tokenStore.clear()
        if (access != null && refresh != null) {
            appScope.launch {
                runCatching { revokeApi(access).logout(LogoutRequest(refreshToken = refresh)) }
            }
        }
    }
}
