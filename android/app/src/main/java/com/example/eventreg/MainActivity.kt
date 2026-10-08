package com.example.eventreg

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.example.eventreg.ui.AppNav
import com.example.eventreg.ui.theme.EventRegTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as EventRegApp).container
        setContent {
            EventRegTheme {
                AppNav(container)
            }
        }
    }
}
