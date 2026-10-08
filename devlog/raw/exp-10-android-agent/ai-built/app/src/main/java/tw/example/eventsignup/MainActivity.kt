package tw.example.eventsignup

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import tw.example.eventsignup.ui.AppRoot
import tw.example.eventsignup.ui.theme.EventSignupTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as EventSignupApp
        setContent {
            EventSignupTheme {
                AppRoot(sessionStore = app.sessionStore, repository = app.repository)
            }
        }
    }
}
