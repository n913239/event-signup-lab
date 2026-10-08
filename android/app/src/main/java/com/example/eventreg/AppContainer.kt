package com.example.eventreg

import android.content.Context
import com.example.eventreg.api.apis.AuthApi
import com.example.eventreg.api.apis.EventsApi
import com.example.eventreg.api.apis.OrdersApi
import com.example.eventreg.data.BearerInterceptor
import com.example.eventreg.data.EventRegRepository
import com.example.eventreg.data.FixedBearerInterceptor
import com.example.eventreg.data.TokenRefreshAuthenticator
import com.example.eventreg.data.TokenStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/** 手動 DI:整個 App 共用一份。 */
class AppContainer(context: Context) {
    val tokenStore = TokenStore(context.applicationContext)

    private val baseUrl = BuildConfig.API_BASE_URL
    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** 不帶身分:login / refresh 用。 */
    private val baseClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    private val publicAuthApi = AuthApi(baseUrl, baseClient)

    private val authedClient = baseClient.newBuilder()
        .addInterceptor(BearerInterceptor(tokenStore))
        .authenticator(TokenRefreshAuthenticator(tokenStore, publicAuthApi))
        .build()

    val repository = EventRegRepository(
        tokenStore = tokenStore,
        authApi = publicAuthApi,
        eventsApi = EventsApi(baseUrl, authedClient),
        ordersApi = OrdersApi(baseUrl, authedClient),
        revokeApi = { token ->
            AuthApi(baseUrl, baseClient.newBuilder().addInterceptor(FixedBearerInterceptor(token)).build())
        },
        appScope = appScope,
    )
}
