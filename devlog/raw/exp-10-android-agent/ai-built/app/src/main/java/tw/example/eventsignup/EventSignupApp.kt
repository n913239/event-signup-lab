package tw.example.eventsignup

import android.app.Application
import tw.example.eventsignup.data.EventSignupRepository
import tw.example.eventsignup.data.SessionStore
import tw.example.eventsignup.data.SharedPrefsSessionPersistence

class EventSignupApp : Application() {
    val sessionStore: SessionStore by lazy { SessionStore(SharedPrefsSessionPersistence(this)) }

    val repository: EventSignupRepository by lazy {
        EventSignupRepository(
            baseUrl = BuildConfig.API_BASE_URL,
            sessionStore = sessionStore,
            debugLogging = BuildConfig.DEBUG,
        )
    }
}
