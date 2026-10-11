package com.example.eventsignup

import android.content.Context
import com.example.eventsignup.api.apis.AuthApi
import com.example.eventsignup.api.apis.EventsApi
import com.example.eventsignup.api.apis.OrdersApi
import com.example.eventsignup.auth.AuthInterceptor
import com.example.eventsignup.auth.Session
import com.example.eventsignup.auth.TokenAuthenticator
import com.example.eventsignup.auth.TokenRefresher
import com.example.eventsignup.auth.TokenStore
import com.google.gson.Gson
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.converter.scalars.ScalarsConverterFactory
import java.util.concurrent.TimeUnit

/**
 * 手動 DI。API 介面全部是 openapi.yaml 產生的(AuthApi / EventsApi / OrdersApi),這裡只負責接線。
 *
 * 兩個 OkHttpClient:
 * - bare:只給 refresh 用,不帶 interceptor / authenticator,避免 401 → refresh → 401 遞迴;
 *   也有自己的 Dispatcher,authenticator 在 OkHttp 執行緒上同步等它時不會跟主 client 搶執行緒。
 * - authed:每個請求帶 access token,401 時換一次 token 再重試一次。
 */
class AppContainer(context: Context) {
    val tokenStore = TokenStore(context.applicationContext)

    private val baseUrl = BuildConfig.API_BASE_URL.trimEnd('/') + "/"
    private val gson = Gson()

    private fun OkHttpClient.Builder.common() = apply {
        connectTimeout(10, TimeUnit.SECONDS)
        readTimeout(20, TimeUnit.SECONDS)
        // BASIC 只記方法、網址、狀態碼,不會把 token 寫進 logcat
        if (BuildConfig.DEBUG) addInterceptor(HttpLoggingInterceptor().setLevel(HttpLoggingInterceptor.Level.BASIC))
    }

    private fun retrofit(client: OkHttpClient): Retrofit = Retrofit.Builder()
        .baseUrl(baseUrl)
        .client(client)
        .addConverterFactory(ScalarsConverterFactory.create())
        .addConverterFactory(GsonConverterFactory.create(gson))
        .build()

    private val bareAuthApi: AuthApi =
        retrofit(OkHttpClient.Builder().common().build()).create(AuthApi::class.java)

    private val refresher = TokenRefresher(tokenStore, bareAuthApi)

    private val authed: Retrofit = retrofit(
        OkHttpClient.Builder()
            .common()
            .addInterceptor(AuthInterceptor(tokenStore))
            .authenticator(TokenAuthenticator(refresher))
            .build()
    )

    val eventsApi: EventsApi = authed.create(EventsApi::class.java)
    val ordersApi: OrdersApi = authed.create(OrdersApi::class.java)
    val session = Session(tokenStore, authed.create(AuthApi::class.java), refresher)
}
