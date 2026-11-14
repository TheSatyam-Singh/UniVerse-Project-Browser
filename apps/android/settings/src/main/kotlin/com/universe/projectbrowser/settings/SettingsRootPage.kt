package com.universe.projectbrowser.settings

import android.content.Context
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import androidx.compose.animation.Crossfade
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.universe.projectbrowser.appmodel.AppModel
import com.universe.projectbrowser.appmodel.SettingsRoute
import com.universe.projectbrowser.design.UniVerseSymbols
import com.universe.projectbrowser.design.UniVerseType
import com.universe.projectbrowser.design.ColorChoiceRows
import com.universe.projectbrowser.design.SettingsGroup
import com.universe.projectbrowser.design.SettingsIconTile
import com.universe.projectbrowser.design.SettingsLayout
import com.universe.projectbrowser.design.SettingsRow
import com.universe.projectbrowser.design.SettingsRowLabel
import com.universe.projectbrowser.design.SettingsTint
import com.universe.projectbrowser.design.Spacing
import com.universe.projectbrowser.design.SystemPalette
import com.universe.projectbrowser.design.Toasts
import com.universe.projectbrowser.design.medium
import com.universe.projectbrowser.design.semibold
import com.universe.projectbrowser.store.AppLinkPreference
import com.universe.projectbrowser.store.AutoArchiveInterval

@Composable
fun SettingsRootPage(nav: SettingsNav) {
    val model = nav.model
    SettingsPage(
        title = stringResource(R.string.settings_title),
        trailing = {
            BarTextButton(stringResource(R.string.settings_done), onClick = nav.close, emphasized = true, modifier = Modifier.testTag(SettingsTags.DONE))
        },
    ) {
        item(key = "sync") {
            SettingsGroup {
                SettingsRow(onClick = { nav.push(SettingsRoute.Sync) }, modifier = Modifier.testTag(SettingsTags.row("sync")), trailing = { Chevron() }) {
                    SyncAccountRow(model)
                }
            }
        }
        item(key = "shortcuts") { SettingsShortcuts(model) }
        item(key = "color") {
            SettingsGroup {
                ColorChoiceRows(
                    look = model.look,
                    colorChoice = model.settings.colorChoice,
                    syncEnabled = model.syncState.isEnabled,
                    onColorChoice = model::setColorChoice,
                )
            }
        }
        item(key = "site") {
            SettingsGroup {
                NavigationRow(
                    stringResource(R.string.settings_site_settings), UniVerseSymbols.globe, SettingsTint.neutral,
                    onClick = { nav.push(SettingsRoute.SiteSettings) }, showsDivider = true, tag = "siteSettings",
                )
                NavigationRow(
                    stringResource(R.string.settings_default_browser), UniVerseSymbols.safariFill, SettingsTint.defaultBrowser,
                    onClick = { nav.push(SettingsRoute.DefaultBrowser) }, tag = "defaultBrowser",
                )
            }
        }
        item(key = "search") { SearchGroup(nav) }
        item(key = "tabs") { TabsGroup(nav) }
        item(key = "about") {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.page)) {
                SettingsGroup {
                    SettingsRow(onClick = model::showOnboardingFromSettings, showsDivider = true, dividerInset = SettingsIconDivider, modifier = Modifier.testTag(SettingsTags.row("onboarding"))) {
                        SettingsRowLabel(stringResource(R.string.settings_show_onboarding), UniVerseSymbols.handWaveFill, SettingsTint.onboarding)
                    }
                    NavigationRow(stringResource(R.string.settings_about_universe), UniVerseSymbols.info, SettingsTint.neutral, onClick = { nav.push(SettingsRoute.About) }, tag = "about")
                }
                Text(
                    rememberAppVersion(),
                    style = UniVerseType.footnote,
                    color = SystemPalette.secondaryLabel.current,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(top = Spacing.tight),
                )
            }
        }
    }
}

@Composable
private fun SearchGroup(nav: SettingsNav) {
    val model = nav.model
    val browsing = model.browsing
    val engineName = SearchEngineNames.current(
        syncEnabled = model.syncState.isEnabled,
        synced = model.syncSnapshot.search,
        localId = browsing.searchEngineId,
        customTitle = stringResource(R.string.search_custom),
    )
    SettingsGroup {
        NavigationRow(
            stringResource(R.string.settings_search_engine), UniVerseSymbols.magnifyingglass, SettingsTint.search,
            onClick = { nav.push(SettingsRoute.SearchEngine) }, value = engineName, showsDivider = true, tag = "searchEngine",
        )
        ToggleRow(
            stringResource(R.string.settings_search_suggestions), browsing.searchSuggestions, model::setSearchSuggestions,
            icon = UniVerseSymbols.textMagnifyingglass, tint = SettingsTint.blue, showsDivider = true, tag = "searchSuggestions",
        )
        ToggleRow(
            stringResource(R.string.settings_auto_open_keyboard), model.settings.autoOpensKeyboard, { model.settings.autoOpensKeyboard = it },
            icon = UniVerseSymbols.keyboardFill, tint = SettingsTint.keyboard, tag = "autoOpenKeyboard",
        )
    }
}

@Composable
private fun TabsGroup(nav: SettingsNav) {
    val model = nav.model
    SettingsGroup {
        PickerRow(
            stringResource(R.string.settings_archive_inactive_tabs),
            options = AutoArchiveInterval.entries,
            selected = model.autoArchiveInterval,
            label = { it.title },
            onSelect = { model.autoArchiveInterval = it },
            icon = UniVerseSymbols.archiveboxFill, tint = SettingsTint.archive, showsDivider = true, tag = "archiveInterval",
        )
        PickerRow(
            stringResource(R.string.settings_open_app_links_in),
            options = AppLinkPreference.entries,
            selected = model.browsing.appLinks,
            label = { it.title },
            onSelect = model::setAppLinks,
            icon = UniVerseSymbols.arrowUpForwardAppFill, tint = SettingsTint.appLinks, showsDivider = true, tag = "appLinks",
        )
        NavigationRow(
            stringResource(R.string.settings_clear_browsing_data), UniVerseSymbols.eraserFill, SettingsTint.clearData,
            onClick = { nav.push(SettingsRoute.ClearData) }, showsDivider = true, tag = "clearData",
        )
        val exportSubject = stringResource(R.string.settings_open_tabs_from_universe)
        SettingsRow(onClick = { exportOpenTabs(model, exportSubject) }, modifier = Modifier.testTag(SettingsTags.row("export"))) {
            SettingsRowLabel(stringResource(R.string.settings_export_open_tabs), UniVerseSymbols.squareAndArrowUpFill, SettingsTint.export)
        }
    }
}

private fun exportOpenTabs(model: AppModel, subject: String) {
    val urls = model.exportableTabUrls()
    if (urls.isEmpty()) {
        model.toasts.show(Toasts.noOpenTabsToExport())
        return
    }
    model.shareText(urls.joinToString("\n"), subject)
}

@Composable
private fun SyncAccountRow(model: AppModel) {
    val words = model.syncState.words
    val accessibility = LocalDensity.current.fontScale >= ACCESSIBILITY_FONT_SCALE
    val subtitle = words.rowSubtitle
    val content: @Composable () -> Unit = {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(words.rowTitle, style = UniVerseType.title3.semibold, color = SystemPalette.label.current)
            Crossfade(subtitle, label = "syncSubtitle") { line ->
                Text(line.text, style = UniVerseType.subheadline, color = if (line.isWarning) warningInk() else SystemPalette.secondaryLabel.current)
            }
        }
    }
    if (accessibility) {
        Column(Modifier.padding(vertical = 6.dp).semantics(mergeDescendants = true) {}, verticalArrangement = Arrangement.spacedBy(Spacing.small)) {
            SettingsIconTile(UniVerseSymbols.macbookAndIphone, SettingsTint.sync, baseSide = 44.dp)
            content()
        }
    } else {
        Row(
            Modifier.padding(vertical = 6.dp).semantics(mergeDescendants = true) {},
            horizontalArrangement = Arrangement.spacedBy(Spacing.small + 2.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SettingsIconTile(UniVerseSymbols.macbookAndIphone, SettingsTint.sync, baseSide = 56.dp)
            content()
        }
    }
}

@Composable
private fun SettingsShortcuts(model: AppModel) {
    val accessibility = LocalDensity.current.fontScale >= ACCESSIBILITY_FONT_SCALE
    val archive = stringResource(R.string.settings_archive)
    val spaces = stringResource(R.string.settings_spaces)
    if (accessibility) {
        Column(Modifier.padding(horizontal = Spacing.page), verticalArrangement = Arrangement.spacedBy(Spacing.small)) {
            ShortcutButton(archive, UniVerseSymbols.archivebox, model::openArchive, Modifier.fillMaxWidth())
            ShortcutButton(spaces, UniVerseSymbols.squareStack, model::openSyncedSpaces, Modifier.fillMaxWidth())
        }
    } else {
        Row(Modifier.padding(horizontal = Spacing.page), horizontalArrangement = Arrangement.spacedBy(Spacing.small)) {
            ShortcutButton(archive, UniVerseSymbols.archivebox, model::openArchive, Modifier.weight(1f))
            ShortcutButton(spaces, UniVerseSymbols.squareStack, model::openSyncedSpaces, Modifier.weight(1f))
        }
    }
}

@Composable
private fun ShortcutButton(title: String, icon: ImageVector, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier
            .heightIn(min = 48.dp)
            .clip(RoundedCornerShape(50))
            .background(SystemPalette.secondaryGroupedBackground.current)
            .clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = Spacing.page, vertical = Spacing.tight),
        horizontalArrangement = Arrangement.spacedBy(Spacing.tight, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, Modifier.size(20.dp), tint = SystemPalette.label.current)
        Text(title, style = UniVerseType.body.medium, color = SystemPalette.label.current)
    }
}

const val ACCESSIBILITY_FONT_SCALE = 1.5f

object AppVersion {
    fun footer(context: Context): String {
        val info = runCatching { packageInfo(context) }.getOrNull()
        val version = info?.versionName ?: "1.0"
        val build = info?.longVersionCode ?: 1L
        return context.getString(R.string.settings_version_footer, version, build.toString())
    }

    @Suppress("DEPRECATION")
    private fun packageInfo(context: Context): PackageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        context.packageManager.getPackageInfo(context.packageName, PackageManager.PackageInfoFlags.of(0))
    } else {
        context.packageManager.getPackageInfo(context.packageName, 0)
    }
}

@Composable
fun rememberAppVersion(): String {
    val context = LocalContext.current
    return remember(context) { AppVersion.footer(context) }
}
