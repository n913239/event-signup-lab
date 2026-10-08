package com.example.eventreg.data

import android.content.Context
import androidx.core.content.edit
import com.example.eventreg.api.models.TokenPair
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * 保存 access / refresh token。存在 app 私有的 SharedPreferences,並在 manifest 關掉備份。
 * 會被 OkHttp 的背景執行緒讀寫(refresh 時),所以寫入用 commit 同步落地。
 */
class TokenStore(context: Context) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val _loggedIn = MutableStateFlow(prefs.getString(KEY_REFRESH, null) != null)
    val loggedIn: StateFlow<Boolean> = _loggedIn.asStateFlow()

    val accessToken: String? get() = prefs.getString(KEY_ACCESS, null)
    val refreshToken: String? get() = prefs.getString(KEY_REFRESH, null)

    fun save(pair: TokenPair) {
        prefs.edit(commit = true) {
            putString(KEY_ACCESS, pair.accessToken)
            putString(KEY_REFRESH, pair.refreshToken)
        }
        _loggedIn.value = true
    }

    fun clear() {
        prefs.edit(commit = true) {
            remove(KEY_ACCESS)
            remove(KEY_REFRESH)
        }
        _loggedIn.value = false
    }

    private companion object {
        const val PREFS_NAME = "session"
        const val KEY_ACCESS = "access_token"
        const val KEY_REFRESH = "refresh_token"
    }
}
