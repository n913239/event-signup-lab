package tw.example.eventsignup.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Color(0xFF1F5FAD),
    secondary = Color(0xFF52606D),
    tertiary = Color(0xFF2E7D32),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFA6C8FF),
    secondary = Color(0xFFBAC8D6),
    tertiary = Color(0xFF8BD18F),
)

@Composable
fun EventSignupTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        content = content,
    )
}
