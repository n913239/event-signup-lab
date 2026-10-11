package com.example.eventsignup.auth

import android.content.Context
import com.example.eventsignup.api.models.TokenPair
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * access token + refresh token 都存下來(加密後放 SharedPreferences),App 重開不用重登。
 * 有 refresh token 就算已登入;refresh 被伺服器拒絕(過期、重放被撤銷)時由 TokenRefresher 呼叫 clear()。
 */
class TokenStore(context: Context) {
    private val prefs = context.getSharedPreferences("session", Context.MODE_PRIVATE)
    private val cipher = KeystoreCipher("event-signup-tokens")
    private val lock = Any()

    @Volatile
    var accessToken: String? = read(KEY_ACCESS)
        private set

    @Volatile
    var refreshToken: String? = read(KEY_REFRESH)
        private set

    @Volatile
    var accessExpiresAt: Long = prefs.getLong(KEY_EXPIRES, 0L)
        private set

    private val _loggedIn = MutableStateFlow(refreshToken != null)
    val loggedIn: StateFlow<Boolean> = _loggedIn.asStateFlow()

    /** access 已過期或 30 秒內過期(用本機時鐘粗估,只用來決定要不要先換 token) */
    fun accessExpiring(nowMs: Long = System.currentTimeMillis()): Boolean =
        accessToken == null || accessExpiresAt - 30_000 <= nowMs

    fun save(pair: TokenPair) = synchronized(lock) {
        accessToken = pair.accessToken
        refreshToken = pair.refreshToken
        accessExpiresAt = pair.expiresAt
        prefs.edit()
            .putString(KEY_ACCESS, cipher.encrypt(pair.accessToken))
            .putString(KEY_REFRESH, cipher.encrypt(pair.refreshToken))
            .putLong(KEY_EXPIRES, pair.expiresAt)
            .apply()
        _loggedIn.value = true
    }

    fun clear() = synchronized(lock) {
        accessToken = null
        refreshToken = null
        accessExpiresAt = 0L
        prefs.edit().clear().apply()
        _loggedIn.value = false
    }

    private fun read(key: String): String? = prefs.getString(key, null)?.let(cipher::decrypt)

    private companion object {
        const val KEY_ACCESS = "access_token"
        const val KEY_REFRESH = "refresh_token"
        const val KEY_EXPIRES = "access_expires_at"
    }
}
