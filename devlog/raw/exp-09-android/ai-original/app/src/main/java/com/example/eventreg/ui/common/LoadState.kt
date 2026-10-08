package com.example.eventreg.ui.common

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.eventreg.BuildConfig
import com.example.eventreg.api.infrastructure.ClientException
import com.example.eventreg.api.infrastructure.ServerException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.IOException

sealed interface LoadState<out T> {
    data object Loading : LoadState<Nothing>
    data class Ready<T>(val data: T) : LoadState<T>
    data class Error(val message: String) : LoadState<Nothing>
}

/** 唯讀畫面共用:載入一次、可重試。 */
class LoaderViewModel<T>(private val fetch: suspend () -> T) : ViewModel() {
    private val _state = MutableStateFlow<LoadState<T>>(LoadState.Loading)
    val state: StateFlow<LoadState<T>> = _state.asStateFlow()
    private var job: Job? = null

    init {
        reload()
    }

    fun reload() {
        job?.cancel()
        _state.value = LoadState.Loading
        job = viewModelScope.launch {
            _state.value = try {
                LoadState.Ready(fetch())
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                LoadState.Error(e.toUserMessage())
            }
        }
    }
}

fun Throwable.toUserMessage(): String = when (this) {
    is ClientException -> when (statusCode) {
        401 -> "登入已失效,請重新登入"
        403 -> "沒有權限查看"
        404 -> "找不到資料"
        else -> "請求失敗(HTTP $statusCode)"
    }
    is ServerException -> "伺服器錯誤(HTTP $statusCode)"
    is IOException -> "無法連線到 ${BuildConfig.API_BASE_URL}"
    else -> message ?: javaClass.simpleName
}
