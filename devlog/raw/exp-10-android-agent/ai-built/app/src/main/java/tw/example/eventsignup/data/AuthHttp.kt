package tw.example.eventsignup.data

import okhttp3.Authenticator
import okhttp3.Interceptor
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import tw.example.eventsignup.api.infrastructure.ClientException
import tw.example.eventsignup.api.models.RefreshRequest
import tw.example.eventsignup.api.models.TokenPair
import java.io.IOException

private val PUBLIC_PATHS = setOf("/auth/login", "/auth/refresh", "/auth/register", "/health")

/** 幫需要身分的請求帶上 Bearer access token。 */
class AuthInterceptor(private val sessionStore: SessionStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val token = sessionStore.current?.accessToken
        val isPublic = PUBLIC_PATHS.any { request.url.encodedPath.endsWith(it) }
        if (token == null || isPublic || request.header(AUTHORIZATION) != null) {
            return chain.proceed(request)
        }
        return chain.proceed(request.withBearer(token))
    }
}

/**
 * access token 過期(401)時用 refresh token 換一組新的再重送一次。
 *
 * 伺服器規則:refresh 輪替後舊的立刻失效,重放會撤銷該成員全部 refresh。
 * 所以換發必須序列化:等鎖的請求若發現 token 已被別人換過,就直接用新的重送,不再呼叫 refresh。
 */
class TokenAuthenticator(
    private val sessionStore: SessionStore,
    private val refresh: (RefreshRequest) -> TokenPair,
) : Authenticator {

    override fun authenticate(route: Route?, response: Response): Request? {
        val sentToken = response.request.header(AUTHORIZATION)?.removePrefix(BEARER) ?: return null
        if (response.priorResponse != null) return null // 換過 token 還是 401,不再重試

        synchronized(this) {
            val current = sessionStore.current ?: return null
            if (current.accessToken != sentToken) {
                return response.request.withBearer(current.accessToken)
            }
            val pair = try {
                refresh(RefreshRequest(current.refreshToken))
            } catch (e: ClientException) {
                // refresh 被拒(過期 / 已撤銷 / 重放):只能重新登入
                sessionStore.clear()
                return null
            } catch (e: IOException) {
                return null // 網路問題:保留 session,讓呼叫端顯示錯誤
            }
            sessionStore.save(pair.toSession(current.email))
            return response.request.withBearer(pair.accessToken)
        }
    }
}

fun TokenPair.toSession(email: String) = Session(
    accessToken = accessToken,
    refreshToken = refreshToken,
    expiresAt = expiresAt,
    email = member.email.ifEmpty { email },
)

private const val AUTHORIZATION = "Authorization"
private const val BEARER = "Bearer "

private fun Request.withBearer(token: String): Request =
    newBuilder().header(AUTHORIZATION, BEARER + token).build()
