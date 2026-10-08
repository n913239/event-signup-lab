package tw.example.eventsignup.ui.common

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import tw.example.eventsignup.data.toUserMessage

sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Error(val message: String) : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
}

class Loaded<T>(val state: UiState<T>, val reload: () -> Unit)

/** 進畫面時載入一次;key 變或呼叫 reload 時重載。 */
@Composable
fun <T> rememberLoad(key: Any?, loader: suspend () -> T): Loaded<T> {
    var tick by remember { mutableIntStateOf(0) }
    val state by produceState<UiState<T>>(UiState.Loading, key, tick) {
        value = UiState.Loading
        value = try {
            UiState.Success(loader())
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            UiState.Error(e.toUserMessage())
        }
    }
    return Loaded(state) { tick++ }
}

@Composable
fun <T> LoadableContent(
    loaded: Loaded<T>,
    modifier: Modifier = Modifier,
    content: @Composable (T) -> Unit,
) {
    when (val s = loaded.state) {
        UiState.Loading -> Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(Modifier.testTag("loading"))
        }
        is UiState.Error -> Column(
            modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(s.message, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("error_message"))
            Button(onClick = loaded.reload, modifier = Modifier.padding(top = 12.dp)) { Text("重試") }
        }
        is UiState.Success -> content(s.data)
    }
}
