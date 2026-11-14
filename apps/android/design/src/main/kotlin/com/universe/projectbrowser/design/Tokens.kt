package com.universe.projectbrowser.design

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

object Palette {
    val accent = adaptive(universeColor(0x6395FC), universeColor(0x4A77D4))
    val formAccent = adaptive(universeColor(0x007AFF), universeColor(0x0A84FF))
    val primaryAction = adaptive(universeColor(0x0F182C), universeColor(0xDCCBD8))
    val onPrimaryAction = adaptive(Color.White, Color.Black)
    val success = adaptive(universeColor(0x34C759), universeColor(0x30D158))
    val panel = adaptive(Color.White, universeColor(0x2A2A2A))
    val panelBorder = adaptive(Color.Black.copy(alpha = 0.1f), Color.White.copy(alpha = 0.1f))
    val toast = adaptive(Color.White.copy(alpha = 0.92f), universeColor(0x2C2A2B, 0.9f))
    val toastShadow = adaptive(Color.Black.copy(alpha = 0.18f), Color.Black.copy(alpha = 0.5f))
}

object Spacing {
    val hairline = 4.dp
    val tight = 8.dp
    val small = 12.dp
    val page = 16.dp
    val medium = 20.dp
    val large = 24.dp
    val section = 32.dp
}

object Radius {
    val field = 16.dp
    val card = 20.dp
    val sheet = 32.dp
}

object Layout {
    const val swipeParallax = -0.33f
    val swipeCommit = 75.dp
    val swipeFlickCommit = 50.dp
}

object SystemPalette {
    val label = adaptive(universeColor(0x000000), universeColor(0xFFFFFF))
    val secondaryLabel = adaptive(universeColor(0x3C3C43, 0.6f), universeColor(0xEBEBF5, 0.6f))
    val tertiaryLabel = adaptive(universeColor(0x3C3C43, 0.3f), universeColor(0xEBEBF5, 0.3f))
    val separator = adaptive(universeColor(0x3C3C43, 0.29f), universeColor(0x545458, 0.6f))
    val tertiaryFill = adaptive(universeColor(0x767680, 0.12f), universeColor(0x767680, 0.24f))
    val background = adaptive(universeColor(0xFFFFFF), universeColor(0x000000))
    val secondaryBackground = adaptive(universeColor(0xF2F2F7), universeColor(0x1C1C1E))
    val groupedBackground = adaptive(universeColor(0xF2F2F7), universeColor(0x000000))
    val secondaryGroupedBackground = adaptive(universeColor(0xFFFFFF), universeColor(0x1C1C1E))
    val green = adaptive(universeColor(0x34C759), universeColor(0x30D158))
    val red = adaptive(universeColor(0xFF3B30), universeColor(0xFF453A))
}
