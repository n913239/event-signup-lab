package com.example.eventsignup.auth

import okhttp3.Authenticator
import okhttp3.HttpUrl
import okhttp3.Interceptor
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route

/** 不需要 bearer 的三條(契約裡 security: [])。logout 需要 bearer,不在這裡。 */
private val publicAuthPaths = listOf("/auth/login", "/auth/register", "/auth/refresh")

private fun HttpUrl.isPublicAuth() = publicAuthPaths.any { encodedPath.endsWith(it) }

/** 每個請求帶 access token。 */
class AuthInterceptor(private val store: TokenStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val req = chain.request()
        val token = store.accessToken
        if (token == null || req.url.isPublicAuth() || req.header("Authorization") != null) {
            return chain.proceed(req)
        }
        return chain.proceed(req.newBuilder().header("Authorization", "Bearer $token").build())
    }
}

/**
 * 401 時用 refresh 換一次新的再重試一次(對應 iOS 的 BearerMiddleware)。
 * /auth/ 底下的不處理:login 401 是帳密錯;logout 若在這裡被重試,body 裡還是舊的 refresh(已被輪替掉),
 * 新的那顆反而撤不到 —— 所以 logout 改在 Session 裡先 refreshIfExpiring()。
 */
class TokenAuthenticator(private val refresher: TokenRefresher) : Authenticator {
    override fun authenticate(route: Route?, response: Response): Request? {
        val req = response.request
        if (req.url.encodedPath.contains("/auth/")) return null
        if (response.priorResponse != null) return null // 已經重試過一次了
        val sent = req.header("Authorization")?.removePrefix("Bearer ")
        val fresh = refresher.refreshAfter401(sent) ?: return null
        return req.newBuilder().header("Authorization", "Bearer $fresh").build()
    }
}
