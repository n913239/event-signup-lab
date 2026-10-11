package com.example.eventsignup.ui

import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navigation
import com.example.eventsignup.AppContainer
import com.example.eventsignup.ui.events.EventDetailScreen
import com.example.eventsignup.ui.events.EventListScreen
import com.example.eventsignup.ui.tickets.TicketDetailScreen
import com.example.eventsignup.ui.tickets.TicketListScreen

private enum class Tab(val graph: String, val label: String, val icon: ImageVector, val tag: String) {
    EVENTS("events_tab", "活動", Icons.Filled.DateRange, "tab_events"),
    TICKETS("tickets_tab", "票券", Icons.AutoMirrored.Filled.List, "tab_tickets"),
}

/** 登入後:兩個分頁(活動、票券),各自有列表 → 明細。 */
@Composable
fun MainScaffold(container: AppContainer) {
    val nav = rememberNavController()
    val backStack by nav.currentBackStackEntryAsState()

    Scaffold(
        contentWindowInsets = WindowInsets(0), // 狀態列交給各畫面的 TopAppBar,導覽列交給 NavigationBar
        bottomBar = {
            NavigationBar {
                Tab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = backStack?.destination?.hierarchy?.any { it.route == tab.graph } == true,
                        onClick = {
                            nav.navigate(tab.graph) {
                                popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(tab.icon, contentDescription = null) },
                        label = { Text(tab.label) },
                        modifier = Modifier.testTag(tab.tag),
                    )
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = nav,
            startDestination = Tab.EVENTS.graph,
            modifier = Modifier.padding(padding).consumeWindowInsets(padding),
        ) {
            navigation(startDestination = "events", route = Tab.EVENTS.graph) {
                composable("events") {
                    EventListScreen(container.eventsApi, onOpen = { id -> nav.navigate("events/$id") })
                }
                composable("events/{id}") { entry ->
                    EventDetailScreen(container.eventsApi, entry.arguments?.getString("id").orEmpty(), onBack = { nav.popBackStack() })
                }
            }
            navigation(startDestination = "tickets", route = Tab.TICKETS.graph) {
                composable("tickets") {
                    TicketListScreen(container.ordersApi, container.session, onOpen = { id -> nav.navigate("tickets/$id") })
                }
                composable("tickets/{id}") { entry ->
                    TicketDetailScreen(container.ordersApi, entry.arguments?.getString("id").orEmpty(), onBack = { nav.popBackStack() })
                }
            }
        }
    }
}
