package com.universe.projectbrowser.design

import androidx.compose.ui.unit.dp

object SettingsTile {
    val side = 29.dp
    val heroSide = 64.dp
}

object SettingsTint {
    val neutral = universeColor(0x86888D)
    val red = universeColor(0xFF5A5F)
    val orange = universeColor(0xFF901A)
    val yellow = universeColor(0xFFC829)
    val blue = universeColor(0x458AFF)
    val deepBlue = universeColor(0x007AFF)
    val purple = universeColor(0xB059EE)
    val green = universeColor(0x3EA82E)

    val sync = blue
    val ads = red
    val trackers = yellow
    val cookies = orange
    val search = deepBlue
    val archive = purple
    val keyboard = yellow
    val swipe = blue
    val nightShade = universeColor(0x5856D6)
    val appLinks = green
    val bottomBar = universeColor(0x30B0C7)
    val defaultBrowser = deepBlue
    val clearData = red
    val export = universeColor(0x0153FF)
    val onboarding = orange
}

object MenuLayout {
    val sheetRadius = 38.dp
    val inset = 16.dp
    val innerRadius = sheetRadius - inset
    val capsuleHeight = innerRadius * 2
    val tileHeight = 68.dp
    val rowHeight = 50.dp
}

object UniVerseColors {
    val accentText = Palette.formAccent
    val title = SystemPalette.label
}
