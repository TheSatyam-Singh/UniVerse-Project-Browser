package com.universe.projectbrowser.android

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Modifier
import com.universe.projectbrowser.appmodel.AppModel
import com.universe.projectbrowser.browsing.BrowsingView
import com.universe.projectbrowser.search.SearchHomeView
import com.universe.projectbrowser.search.SearchTrayHost
import com.universe.projectbrowser.search.VoiceSearchView
import com.universe.projectbrowser.settings.OnboardingView
import com.universe.projectbrowser.settings.SettingsView
import com.universe.projectbrowser.settings.SyncSetupView
import com.universe.projectbrowser.tabs.ArchiveView
import com.universe.projectbrowser.tabs.SyncedSpacesView
import com.universe.projectbrowser.tabs.TabSwitcherView

@Immutable
class RootScreens(
    val searchStart: @Composable (AppModel, Modifier) -> Unit,
    val searchTray: @Composable (AppModel, Modifier) -> Unit,
    val voiceSearch: @Composable (AppModel) -> Unit,
    val browsing: @Composable (AppModel, Boolean, Modifier) -> Unit,
    val tabDeck: @Composable (AppModel, Modifier) -> Unit,
    val archive: @Composable (AppModel) -> Unit,
    val syncedSpaces: @Composable (AppModel) -> Unit,
    val settings: @Composable (AppModel) -> Unit,
    val syncSetup: @Composable (AppModel) -> Unit,
    val onboarding: @Composable (AppModel) -> Unit,
) {
    companion object {
        val app = RootScreens(
            searchStart = { model, modifier -> SearchHomeView(model, modifier) },
            searchTray = { model, modifier -> SearchTrayHost(model, modifier) },
            voiceSearch = { model -> VoiceSearchView(model, Modifier.fillMaxSize()) },
            browsing = { model, isFront, modifier -> BrowsingView(model, isFront, modifier) },
            tabDeck = { model, modifier -> TabSwitcherView(model, modifier) },
            archive = { model -> ArchiveView(model, Modifier.fillMaxSize()) },
            syncedSpaces = { model -> SyncedSpacesView(model, Modifier.fillMaxSize()) },
            settings = { model -> SettingsView(model, Modifier.fillMaxSize()) },
            syncSetup = { model -> SyncSetupView(model, Modifier.fillMaxSize()) },
            onboarding = { model -> OnboardingView(model, Modifier.fillMaxSize()) },
        )
    }
}
