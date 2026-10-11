package com.example.eventsignup.ui.common

import com.google.gson.JsonParser
import kotlinx.coroutines.CancellationException
import retrofit2.Response
import java.io.IOException

sealed interface Loadable<out T> {
    data object Loading : Loadable<Nothing>
    data class Failed(val message: String) : Loadable<Nothing>
    data class Ready<out T>(val value: T) : Loadable<T>
}

inline fun <T, R> Loadable<T>.map(f: (T) -> R): Loadable<R> = when (this) {
    is Loadable.Ready -> Loadable.Ready(f(value))
    is Loadable.Failed -> this
    Loadable.Loading -> Loadable.Loading
}

/** 呼叫產生的 API,把 2xx / 錯誤 / 連線失敗收成 Loadable。 */
suspend fun <T : Any> fetch(call: suspend () -> Response<T>): Loadable<T> = try {
    val res = call()
    val body = res.body()
    if (res.isSuccessful && body != null) Loadable.Ready(body) else Loadable.Failed(describeError(res))
} catch (e: CancellationException) {
    throw e
} catch (e: IOException) {
    Loadable.Failed(describeIo(e))
} catch (e: RuntimeException) {
    Loadable.Failed("回應格式不對:${e.message}") // 例如 JsonSyntaxException
}

/** 錯誤一律 { error, server_now };顯示 error 代碼。 */
fun describeError(res: Response<*>): String {
    val code = runCatching {
        res.errorBody()?.string()?.let { JsonParser.parseString(it).asJsonObject.get("error")?.asString }
    }.getOrNull()
    return when (res.code()) {
        401 -> "登入已失效,請重新登入"
        else -> code ?: "http_${res.code()}"
    }
}

fun describeIo(e: IOException): String = "連不上伺服器(${e.javaClass.simpleName})"
