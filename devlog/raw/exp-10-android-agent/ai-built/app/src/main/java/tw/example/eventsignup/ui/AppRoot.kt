package tw.example.eventsignup.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import tw.example.eventsignup.data.EventSignupRepository
import tw.example.eventsignup.data.SessionStore
import tw.example.eventsignup.ui.screens.EventDetailScreen
import tw.example.eventsignup.ui.screens.EventListScreen
import tw.example.eventsignup.ui.screens.LoginScreen
import tw.example.eventsignup.ui.screens.OrderDetailScreen
import tw.example.eventsignup.ui.screens.OrderListScreen

private object Routes {
    const val LOGIN = "login"
    const val EVENTS = "events"
    const val EVENT_DETAIL = "events/{id}"
    const val ORDERS = "orders"
    const val ORDER_DETAIL = "orders/{id}"

    fun eventDetail(id: String) = "events/${android.net.Uri.encode(id)}"
    fun orderDetail(id: String) = "orders/${android.net.Uri.encode(id)}"
}

private val TOP_LEVEL = setOf(Routes.EVENTS, Routes.ORDERS)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppRoot(sessionStore: SessionStore, repository: EventSignupRepository) {
    val navController = rememberNavController()
    val session by sessionStore.session.collectAsStateWithLifecycle()
    val backStack by navController.currentBackStackEntryAsState()
    val route = backStack?.destination?.route
    val scope = rememberCoroutineScope()
    val startDestination = remember { if (sessionStore.current != null) Routes.EVENTS else Routes.LOGIN }

    // 登出或 refresh 失效 → 回登入頁並清掉返回堆疊
    LaunchedEffect(session == null) {
        if (session == null && route != null && route != Routes.LOGIN) {
            withContext(Dispatchers.Main) {
                navController.navigate(Routes.LOGIN) { popUpTo(0) { inclusive = true } }
            }
        }
    }

    Scaffold(
        topBar = {
            if (route != null && route != Routes.LOGIN) {
                TopAppBar(
                    title = { Text(titleFor(route)) },
                    navigationIcon = {
                        if (route !in TOP_LEVEL) {
                            IconButton(onClick = { navController.popBackStack() }, modifier = Modifier.testTag("nav_back")) {
                                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                            }
                        }
                    },
                    actions = {
                        IconButton(
                            onClick = { scope.launch { repository.logout() } },
                            modifier = Modifier.testTag("logout"),
                        ) {
                            Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = "登出")
                        }
                    },
                )
            }
        },
        bottomBar = {
            if (route in TOP_LEVEL) {
                NavigationBar {
                    NavigationBarItem(
                        selected = route == Routes.EVENTS,
                        onClick = { navController.switchTab(Routes.EVENTS) },
                        icon = { Icon(Icons.Filled.DateRange, contentDescription = null) },
                        label = { Text("活動") },
                        modifier = Modifier.testTag("tab_events"),
                    )
                    NavigationBarItem(
                        selected = route == Routes.ORDERS,
                        onClick = { navController.switchTab(Routes.ORDERS) },
                        icon = { Icon(Icons.Filled.ShoppingCart, contentDescription = null) },
                        label = { Text("我的票券") },
                        modifier = Modifier.testTag("tab_orders"),
                    )
                }
            }
        },
    ) { padding ->
        NavHost(navController, startDestination = startDestination, modifier = Modifier.padding(padding)) {
            composable(Routes.LOGIN) {
                LoginScreen(
                    onLogin = repository::login,
                    onLoggedIn = {
                        navController.navigate(Routes.EVENTS) { popUpTo(Routes.LOGIN) { inclusive = true } }
                    },
                )
            }
            composable(Routes.EVENTS) {
                EventListScreen(repository, onOpen = { navController.navigate(Routes.eventDetail(it)) })
            }
            composable(Routes.EVENT_DETAIL) { entry ->
                EventDetailScreen(repository, eventId = entry.arguments?.getString("id").orEmpty())
            }
            composable(Routes.ORDERS) {
                OrderListScreen(repository, onOpen = { navController.navigate(Routes.orderDetail(it)) })
            }
            composable(Routes.ORDER_DETAIL) { entry ->
                OrderDetailScreen(repository, orderId = entry.arguments?.getString("id").orEmpty())
            }
        }
    }
}

private fun titleFor(route: String): String = when (route) {
    Routes.EVENTS -> "開賣中的活動"
    Routes.EVENT_DETAIL -> "座位圖"
    Routes.ORDERS -> "我的票券"
    Routes.ORDER_DETAIL -> "票券明細"
    else -> ""
}

private fun NavHostController.switchTab(route: String) {
    navigate(route) {
        // 登入後活動列表永遠是堆疊底部(登入頁已被 pop),以它為分頁根
        popUpTo(Routes.EVENTS) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}
