package com.example.eventreg.data

import com.example.eventreg.api.apis.AuthApi
import com.example.eventreg.api.infrastructure.ClientException
import com.example.eventreg.api.models.RefreshRequest
import okhttp3.Authenticator
import okhttp3.Interceptor
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route

private const val AUTHORIZATION = "Authorization"

private fun Request.withBearer(token: String): Request =
    newBuilder().header(AUTHORIZATION, "Bearer $token").build()

/** 對需要身分的 API 帶上目前的 access token。 */
class BearerInterceptor(private val tokenStore: TokenStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val token = tokenStore.accessToken
        if (token == null || request.header(AUTHORIZATION) != null) return chain.proceed(request)
        return chain.proceed(request.withBearer(token))
    }
}

/** 給登出用:token 已從本機清掉,但撤銷請求仍需帶原本的 access token。 */
class FixedBearerInterceptor(private val token: String) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response =
        chain.proceed(chain.request().withBearer(token))
}

/**
 * access 過期(401)時用 refresh token 換一組新的再重送一次。
 *
 * 後端的 refresh 會輪替,且「重放舊 refresh → 撤銷該成員全部 refresh」。
 * 所以同時有多個請求 401 時,只能有一個去換;其他的等它換完直接用新 token,
 * 不然第二個請求會拿已失效的舊 refresh 去換,觸發重放偵測把整個帳號登出。
 */
class TokenRefreshAuthenticator(
    private val tokenStore: TokenStore,
    private val authApi: AuthApi,
) : Authenticator {
    private val lock = Any()

    override fun authenticate(route: Route?, response: Response): Request? {
        val sent = response.request.header(AUTHORIZATION) ?: return null
        // 已經用新 token 重送過還是 401:不是過期問題,登出讓使用者重來
        if (response.priorResponse != null) {
            tokenStore.clear()
            return null
        }
        synchronized(lock) {
            val current = tokenStore.accessToken
            if (current != null && "Bearer $current" != sent) {
                // 別的請求已經換好了
                return response.request.withBearer(current)
            }
            val refresh = tokenStore.refreshToken ?: return null
            val pair = try {
                authApi.refresh(RefreshRequest(refreshToken = refresh))
            } catch (e: ClientException) {
                // refresh 過期 / 被撤銷 / 重放:session 結束
                tokenStore.clear()
                return null
            } catch (e: Exception) {
                // 網路或伺服器錯誤:保留 token,讓原本的 401 往上拋,使用者可重試
                return null
            }
            tokenStore.save(pair)
            return response.request.withBearer(pair.accessToken)
        }
    }
}
