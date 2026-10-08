package com.example.eventreg.ui

import android.net.Uri
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.example.eventreg.AppContainer
import com.example.eventreg.ui.common.LoaderViewModel
import com.example.eventreg.ui.events.EventDetailScreen
import com.example.eventreg.ui.events.EventListScreen
import com.example.eventreg.ui.login.LoginScreen
import com.example.eventreg.ui.login.LoginViewModel
import com.example.eventreg.ui.orders.OrderDetailScreen
import com.example.eventreg.ui.orders.OrderListScreen

private object Routes {
    const val LOGIN = "login"
    const val EVENTS = "events"
    const val EVENT_DETAIL = "events/{id}"
    const val ORDERS = "orders"
    const val ORDER_DETAIL = "orders/{id}"

    fun event(id: String) = "events/${Uri.encode(id)}"
    fun order(id: String) = "orders/${Uri.encode(id)}"
}

@Composable
fun AppNav(container: AppContainer) {
    val nav = rememberNavController()
    val repo = container.repository
    val loggedIn by container.tokenStore.loggedIn.collectAsStateWithLifecycle()
    val startRoute = remember { if (container.tokenStore.loggedIn.value) Routes.EVENTS else Routes.LOGIN }

    // 登入狀態是唯一的導航依據:登入成功、手動登出、refresh 失效都走這裡
    LaunchedEffect(loggedIn) {
        val current = nav.currentDestination?.route ?: return@LaunchedEffect
        if (loggedIn && current == Routes.LOGIN) {
            nav.navigate(Routes.EVENTS) { popUpTo(Routes.LOGIN) { inclusive = true } }
        } else if (!loggedIn && current != Routes.LOGIN) {
            nav.navigate(Routes.LOGIN) { popUpTo(nav.graph.id) { inclusive = true } }
        }
    }

    val bottomBar: @Composable (String) -> Unit = { selected ->
        MainBottomBar(selected) { route ->
            if (route != selected) {
                nav.navigate(route) {
                    popUpTo(Routes.EVENTS)
                    launchSingleTop = true
                }
            }
        }
    }
    val idArg = listOf(navArgument("id") { type = NavType.StringType })

    NavHost(navController = nav, startDestination = startRoute) {
        composable(Routes.LOGIN) {
            LoginScreen(viewModel { LoginViewModel(repo) })
        }
        composable(Routes.EVENTS) {
            EventListScreen(
                vm = viewModel { LoaderViewModel { repo.onSaleEvents() } },
                bottomBar = { bottomBar(Routes.EVENTS) },
                onLogout = repo::logout,
                onOpen = { id -> nav.navigate(Routes.event(id)) },
            )
        }
        composable(Routes.EVENT_DETAIL, arguments = idArg) { entry ->
            val id = entry.arguments?.getString("id").orEmpty()
            EventDetailScreen(
                vm = viewModel { LoaderViewModel { repo.event(id) } },
                onBack = { nav.popBackStack() },
            )
        }
        composable(Routes.ORDERS) {
            OrderListScreen(
                vm = viewModel { LoaderViewModel { repo.orders() } },
                bottomBar = { bottomBar(Routes.ORDERS) },
                onLogout = repo::logout,
                onOpen = { id -> nav.navigate(Routes.order(id)) },
            )
        }
        composable(Routes.ORDER_DETAIL, arguments = idArg) { entry ->
            val id = entry.arguments?.getString("id").orEmpty()
            OrderDetailScreen(
                vm = viewModel { LoaderViewModel { repo.order(id) } },
                onBack = { nav.popBackStack() },
            )
        }
    }
}

@Composable
private fun MainBottomBar(selected: String, onSelect: (String) -> Unit) {
    NavigationBar {
        NavigationBarItem(
            selected = selected == Routes.EVENTS,
            onClick = { onSelect(Routes.EVENTS) },
            icon = { Icon(Icons.Filled.DateRange, contentDescription = null) },
            label = { Text("活動") },
            modifier = Modifier.testTag("tab_events"),
        )
        NavigationBarItem(
            selected = selected == Routes.ORDERS,
            onClick = { onSelect(Routes.ORDERS) },
            icon = { Icon(Icons.AutoMirrored.Filled.List, contentDescription = null) },
            label = { Text("我的票券") },
            modifier = Modifier.testTag("tab_orders"),
        )
    }
}
