package com.example.eventsignup.auth

import com.example.eventsignup.api.apis.AuthApi
import com.example.eventsignup.api.models.LoginRequest
import com.example.eventsignup.api.models.LogoutRequest
import com.example.eventsignup.ui.common.describeError
import com.example.eventsignup.ui.common.describeIo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException

class Session(
    private val store: TokenStore,
    private val authApi: AuthApi,
    private val refresher: TokenRefresher,
) {
    /** 成功回 null(TokenStore.loggedIn 會變 true,畫面自己切換);失敗回要顯示的訊息。 */
    suspend fun login(email: String, password: String): String? = try {
        val res = authApi.login(LoginRequest(email = email, password = password))
        val pair = res.body()
        when {
            res.isSuccessful && pair != null -> { store.save(pair); null }
            res.code() == 401 -> "email 或密碼錯誤"
            res.code() == 400 -> "輸入格式不對(invalid_input)"
            else -> describeError(res)
        }
    } catch (e: IOException) {
        describeIo(e)
    }

    /**
     * 登出要先讓伺服器撤銷 refresh。連不上就保留登入狀態並回 false(同 iOS T084):
     * 只清本機的話,伺服器那顆 refresh 30 天內還能用。伺服器有回應(含 401 已失效)才清本機。
     */
    suspend fun logout(): Boolean = withContext(Dispatchers.IO) {
        refresher.refreshIfExpiring()
        val refresh = store.refreshToken ?: run { store.clear(); return@withContext true }
        try {
            authApi.logout(LogoutRequest(refreshToken = refresh))
        } catch (e: IOException) {
            return@withContext false
        }
        store.clear()
        true
    }
}
