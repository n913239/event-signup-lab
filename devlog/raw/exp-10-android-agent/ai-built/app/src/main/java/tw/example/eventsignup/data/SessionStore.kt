package tw.example.eventsignup.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class Session(
    val accessToken: String,
    val refreshToken: String,
    /** access token 到期時間(epoch 毫秒,伺服器時鐘) */
    val expiresAt: Long,
    val email: String,
)

/** Session 的持久化方式;正式用 SharedPreferences,單元測試用記憶體版。 */
interface SessionPersistence {
    fun load(): Session?
    fun save(session: Session?)
}

class SharedPrefsSessionPersistence(context: Context) : SessionPersistence {
    private val prefs = context.getSharedPreferences("session", Context.MODE_PRIVATE)

    override fun load(): Session? {
        val access = prefs.getString(KEY_ACCESS, null) ?: return null
        val refresh = prefs.getString(KEY_REFRESH, null) ?: return null
        return Session(
            accessToken = access,
            refreshToken = refresh,
            expiresAt = prefs.getLong(KEY_EXPIRES_AT, 0L),
            email = prefs.getString(KEY_EMAIL, "").orEmpty(),
        )
    }

    override fun save(session: Session?) {
        // commit():refresh token 一經輪替舊的就失效,必須確實寫入才能回傳。
        val editor = prefs.edit().clear()
        if (session != null) {
            editor.putString(KEY_ACCESS, session.accessToken)
                .putString(KEY_REFRESH, session.refreshToken)
                .putLong(KEY_EXPIRES_AT, session.expiresAt)
                .putString(KEY_EMAIL, session.email)
        }
        editor.commit()
    }

    private companion object {
        const val KEY_ACCESS = "access_token"
        const val KEY_REFRESH = "refresh_token"
        const val KEY_EXPIRES_AT = "expires_at"
        const val KEY_EMAIL = "email"
    }
}

/** 目前登入狀態的唯一來源;UI 觀察 [session],變成 null 就回登入頁。 */
class SessionStore(private val persistence: SessionPersistence) {
    private val _session = MutableStateFlow(persistence.load())
    val session: StateFlow<Session?> = _session.asStateFlow()

    val current: Session? get() = _session.value

    @Synchronized
    fun save(session: Session) {
        persistence.save(session)
        _session.value = session
    }

    @Synchronized
    fun clear() {
        persistence.save(null)
        _session.value = null
    }
}
