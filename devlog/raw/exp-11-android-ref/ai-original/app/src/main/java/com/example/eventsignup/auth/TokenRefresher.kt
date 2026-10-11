package com.example.eventsignup.auth

import com.example.eventsignup.api.apis.AuthApi
import com.example.eventsignup.api.models.RefreshRequest
import kotlinx.coroutines.runBlocking
import java.io.IOException

/**
 * 用 refresh token 換新的一組 token。全部經過同一把鎖:
 * 伺服器的 refresh 是輪替制,同一顆送兩次會被當成重放、撤銷這個成員全部的 refresh,
 * 所以多個請求同時 401 時只能有一個真的去換,其他的直接用換好的。
 *
 * 會阻塞呼叫端執行緒(OkHttp authenticator 本來就是同步介面);用的是不帶 authenticator 的 bare AuthApi。
 */
class TokenRefresher(
    private val store: TokenStore,
    private val bareAuthApi: AuthApi,
) {
    private val lock = Any()

    /** 某個請求帶 [failedAccess] 拿到 401。回可以重試的 access token;null = 換不到。 */
    fun refreshAfter401(failedAccess: String?): String? = synchronized(lock) {
        val current = store.accessToken
        if (current != null && current != failedAccess) return current // 別的請求剛換好
        refreshLocked()
    }

    /** access 快過期就先換(登出前用:logout 本身也要 bearer,過期的話會 401、refresh 撤不掉)。 */
    fun refreshIfExpiring() {
        synchronized(lock) {
            if (store.refreshToken == null || !store.accessExpiring()) return
            refreshLocked()
        }
    }

    private fun refreshLocked(): String? {
        val refresh = store.refreshToken ?: return null
        val res = try {
            runBlocking { bareAuthApi.refresh(RefreshRequest(refresh)) }
        } catch (e: IOException) {
            return null // 連不上:保留登入狀態,下次再試
        }
        val pair = res.body()
        if (res.isSuccessful && pair != null) {
            store.save(pair)
            return pair.accessToken
        }
        if (res.code() == 401) store.clear() // refresh 過期 / 被撤銷 → 回登入畫面
        return null
    }
}
