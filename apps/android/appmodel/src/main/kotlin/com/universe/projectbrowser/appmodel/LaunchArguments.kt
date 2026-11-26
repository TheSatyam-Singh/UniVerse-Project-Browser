package com.universe.projectbrowser.appmodel

import android.content.Intent
import android.os.Bundle

data class LaunchArguments(
    val isDemo: Boolean = false,
    val browseOpen: String? = null,
    val browseQuery: String? = null,
    val browseSurface: String? = null,
    val browseTab: Int? = null,
    val browseToolbar: Boolean = false,
    val browseReader: Boolean = false,
    val browseIncognito: Boolean = false,
    val browseDelaySeconds: Double = DEFAULT_DELAY_SECONDS,
    val browseDeck: Boolean = false,
    val browseDeckOpen: Int? = null,
    val browsePlus: Boolean = false,
    val browseOverlay: String? = null,
    val browseSteps: List<Int> = emptyList(),
    val browseStepGapSeconds: Double = DEFAULT_STEP_GAP_SECONDS,
    val deckScript: String? = null,
    val showsOnboarding: Boolean = false,
    val openSheet: String? = null,
    val opensSettings: Boolean = false,
    val restingStart: Boolean = false,
    val color: String? = null,
    val toast: String? = null,
    val trustedSitesSample: Boolean = false,
    val pagerFreeze: Double? = null,
    val pagerScript: Boolean = false,
    val loadFreeze: Double? = null,
) {
    val browseDelayMillis: Long get() = (browseDelaySeconds * 1000).toLong()

    companion object {
        const val DEFAULT_DELAY_SECONDS = 6.0
        const val DEFAULT_STEP_GAP_SECONDS = 1.5

        const val UNIVERSE_DEMO = "UniVerseDemo"
        const val BROWSE_OPEN = "BrowseOpen"
        const val BROWSE_QUERY = "BrowseQuery"
        const val BROWSE_SURFACE = "BrowseSurface"
        const val BROWSE_TAB = "BrowseTab"
        const val BROWSE_TOOLBAR = "BrowseToolbar"
        const val BROWSE_READER = "BrowseReader"
        const val BROWSE_INCOGNITO = "BrowseIncognito"
        const val BROWSE_DELAY = "BrowseDelay"
        const val BROWSE_DECK = "BrowseDeck"
        const val BROWSE_DECK_OPEN = "BrowseDeckOpen"
        const val BROWSE_PLUS = "BrowsePlus"
        const val BROWSE_OVERLAY = "BrowseOverlay"
        const val BROWSE_STEPS = "BrowseSteps"
        const val BROWSE_STEP_GAP = "BrowseStepGap"
        const val UNIVERSE_DECK = "UniVerseDeck"
        const val UNIVERSE_ONBOARDING = "UniVerseOnboarding"
        const val UNIVERSE_OPEN_SHEET = "UniVerseOpenSheet"
        const val UNIVERSE_OPEN_SETTINGS = "UniVerseOpenSettings"
        const val UNIVERSE_RESTING_START = "UniVerseRestingStart"
        const val UNIVERSE_COLOR = "UniVerseColor"
        const val UNIVERSE_TOAST = "UniVerseToast"
        const val UNIVERSE_TRUSTED_SITES = "UniVerseTrustedSites"
        const val BROWSE_PAGER_FREEZE = "BrowsePagerFreeze"
        const val BROWSE_PAGER_SCRIPT = "BrowsePagerScript"
        const val BROWSE_LOAD_FREEZE = "BrowseLoadFreeze"

        val none = LaunchArguments()

        fun fromIntent(intent: Intent?): LaunchArguments = fromBundle(intent?.extras)

        fun fromBundle(extras: Bundle?): LaunchArguments {
            if (extras == null) return none
            @Suppress("DEPRECATION")
            return parse(extras.keySet().associateWith { extras.get(it) })
        }

        fun parse(values: Map<String, Any?>): LaunchArguments {
            fun text(key: String): String? = values[key]?.toString()?.trim()?.takeIf { it.isNotEmpty() }
            fun flag(key: String): Boolean = when (val value = values[key]) {
                null -> false
                is Boolean -> value
                is Number -> value.toInt() != 0
                else -> value.toString().trim().lowercase() !in setOf("false", "no", "0")
            }
            fun number(key: String): Double? = text(key)?.toDoubleOrNull()
            fun whole(key: String): Int? = number(key)?.toInt()
            val isDemo = flag(UNIVERSE_DEMO)
            return LaunchArguments(
                isDemo = isDemo,
                browseOpen = text(BROWSE_OPEN),
                browseQuery = values[BROWSE_QUERY]?.toString(),
                browseSurface = text(BROWSE_SURFACE),
                browseTab = whole(BROWSE_TAB),
                browseToolbar = flag(BROWSE_TOOLBAR),
                browseReader = flag(BROWSE_READER),
                browseIncognito = flag(BROWSE_INCOGNITO),
                browseDelaySeconds = number(BROWSE_DELAY) ?: DEFAULT_DELAY_SECONDS,
                browseDeck = flag(BROWSE_DECK),
                browseDeckOpen = whole(BROWSE_DECK_OPEN),
                browsePlus = flag(BROWSE_PLUS),
                browseOverlay = values[BROWSE_OVERLAY]?.toString(),
                browseSteps = text(BROWSE_STEPS)?.split(',')?.mapNotNull { it.trim().toIntOrNull() }.orEmpty(),
                browseStepGapSeconds = number(BROWSE_STEP_GAP) ?: DEFAULT_STEP_GAP_SECONDS,
                deckScript = text(UNIVERSE_DECK),
                showsOnboarding = flag(UNIVERSE_ONBOARDING),
                openSheet = text(UNIVERSE_OPEN_SHEET),
                opensSettings = flag(UNIVERSE_OPEN_SETTINGS),
                restingStart = flag(UNIVERSE_RESTING_START),
                color = text(UNIVERSE_COLOR),
                toast = text(UNIVERSE_TOAST),
                trustedSitesSample = flag(UNIVERSE_TRUSTED_SITES),
                pagerFreeze = if (isDemo) number(BROWSE_PAGER_FREEZE) else null,
                pagerScript = isDemo && flag(BROWSE_PAGER_SCRIPT),
                loadFreeze = if (isDemo) number(BROWSE_LOAD_FREEZE) else null,
            )
        }
    }
}
