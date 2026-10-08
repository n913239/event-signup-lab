package com.example.eventreg.ui.login

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.eventreg.api.infrastructure.ClientException
import com.example.eventreg.data.EventRegRepository
import com.example.eventreg.ui.common.toUserMessage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

class LoginViewModel(private val repo: EventRegRepository) : ViewModel() {
    var email by mutableStateOf("")
    var password by mutableStateOf("")
    var submitting by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set

    /** 成功後 TokenStore.loggedIn 變 true,由 AppNav 負責換頁。 */
    fun submit() {
        if (submitting) return
        if (email.isBlank() || password.isEmpty()) {
            error = "請輸入 email 與密碼"
            return
        }
        submitting = true
        error = null
        viewModelScope.launch {
            try {
                repo.login(email.trim(), password)
            } catch (e: CancellationException) {
                throw e
            } catch (e: ClientException) {
                error = when (e.statusCode) {
                    401 -> "帳號或密碼錯誤"
                    400 -> "輸入格式不正確"
                    else -> e.toUserMessage()
                }
            } catch (e: Exception) {
                error = e.toUserMessage()
            } finally {
                submitting = false
            }
        }
    }
}

@Composable
fun LoginScreen(vm: LoginViewModel) {
    Scaffold { padding ->
        // 小螢幕 + 大字級時鍵盤升起後放不下整份表單:表單區可捲動,「登入」固定在鍵盤上方
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .consumeWindowInsets(padding)
                .imePadding()
                .padding(24.dp),
        ) {
            BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .heightIn(min = maxHeight),
                    verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
                ) {
                    Text("活動報名", style = MaterialTheme.typography.headlineMedium)
                    OutlinedTextField(
                        value = vm.email,
                        onValueChange = { vm.email = it },
                        label = { Text("Email") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                        modifier = Modifier.fillMaxWidth().testTag("login_email"),
                    )
                    OutlinedTextField(
                        value = vm.password,
                        onValueChange = { vm.password = it },
                        label = { Text("密碼") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = { vm.submit() }),
                        modifier = Modifier.fillMaxWidth().testTag("login_password"),
                    )
                    vm.error?.let {
                        Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("login_error"))
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = vm::submit,
                enabled = !vm.submitting,
                modifier = Modifier.fillMaxWidth().testTag("login_submit"),
            ) {
                if (vm.submitting) {
                    CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                } else {
                    Text("登入")
                }
            }
        }
    }
}
