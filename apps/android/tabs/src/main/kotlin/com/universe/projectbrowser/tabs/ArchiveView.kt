package com.universe.projectbrowser.tabs

import android.text.format.DateFormat
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.universe.projectbrowser.appmodel.AppModel
import com.universe.projectbrowser.design.UniVerseSymbols
import com.universe.projectbrowser.design.UniVerseType
import com.universe.projectbrowser.design.BrowsePalette
import com.universe.projectbrowser.design.FaviconImage
import com.universe.projectbrowser.design.LocalUniVerseDarkTheme
import com.universe.projectbrowser.design.LocalProfileLook
import com.universe.projectbrowser.design.Palette
import com.universe.projectbrowser.design.Spacing
import com.universe.projectbrowser.design.SystemPalette
import com.universe.projectbrowser.design.ProfileBackdrop
import com.universe.projectbrowser.design.semibold
import com.universe.projectbrowser.store.AutoArchiveInterval
import com.universe.projectbrowser.store.BrowserTab
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.delay

@Composable
fun ArchiveView(model: AppModel, modifier: Modifier = Modifier) {
    val dark = LocalUniVerseDarkTheme.current
    val look = LocalProfileLook.current
    val haptics = rememberHaptics()
    var query by rememberSaveable { mutableStateOf("") }
    var isConfirmingClear by remember { mutableStateOf(false) }
    LaunchedEffect(model) { model.loadArchive() }
    BackHandler {
        if (query.isNotEmpty()) query = "" else model.sheet = null
    }
    Box(modifier.fillMaxSize().testTag(ARCHIVE_TAG)) {
        ProfileBackdrop(Modifier.matchParentSize(), look = look)
        ArchiveContent(model, query, onQuery = { query = it }, haptics, confirmClear = { isConfirmingClear = true })
    }
    if (isConfirmingClear) {
        AlertDialog(
            onDismissRequest = { isConfirmingClear = false },
            title = { Text(stringResource(R.string.archive_delete_all_title), style = UniVerseType.headline) },
            text = { Text(stringResource(R.string.archive_delete_all_message)) },
            confirmButton = {
                TextButton(onClick = {
                    isConfirmingClear = false
                    haptics.warning()
                    model.clearArchive()
                }) { Text(stringResource(R.string.archive_delete_all), color = SystemPalette.red.resolve(dark)) }
            },
            dismissButton = { TextButton(onClick = { isConfirmingClear = false }) { Text(stringResource(R.string.tabs_cancel)) } },
        )
    }
}

@Composable
private fun ArchiveContent(model: AppModel, query: String, onQuery: (String) -> Unit, haptics: Haptics, confirmClear: () -> Unit) {
    val trimmed = query.trim()
    Column(
        Modifier
            .fillMaxSize()
            .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal))
            .imePadding(),
    ) {
        ArchiveTopBar(
            interval = model.autoArchiveInterval,
            canDelete = model.archive.isNotEmpty(),
            done = { model.sheet = null },
            choose = { model.autoArchiveInterval = it },
            deleteAll = confirmClear,
        )
        ArchiveSearchField(query, onChange = onQuery)
        val days = model.archive
        Box(Modifier.fillMaxSize()) {
            when {
                days.isEmpty() -> if (model.archiveLoaded) ArchiveEmptyState(Modifier.align(Alignment.Center))
                trimmed.isNotEmpty() -> ArchiveResults(model, trimmed, haptics)
                else -> ArchiveDays(model, haptics)
            }
        }
    }
}

@Composable
private fun ArchiveTopBar(interval: AutoArchiveInterval, canDelete: Boolean, done: () -> Unit, choose: (AutoArchiveInterval) -> Unit, deleteAll: () -> Unit) {
    val dark = LocalUniVerseDarkTheme.current
    var menu by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxWidth().heightIn(min = 52.dp).padding(horizontal = Spacing.tight)) {
        TextButton(onClick = done, modifier = Modifier.align(Alignment.CenterStart)) {
            Text(stringResource(R.string.archive_done), style = UniVerseType.body.semibold, color = Palette.formAccent.resolve(dark))
        }
        Text(
            stringResource(R.string.archive_title),
            style = UniVerseType.headline,
            color = SystemPalette.label.resolve(dark),
            modifier = Modifier.align(Alignment.Center).semantics { heading() },
        )
        Box(Modifier.align(Alignment.CenterEnd)) {
            val options = stringResource(R.string.archive_options)
            IconButton(onClick = { menu = true }, modifier = Modifier.semantics { contentDescription = options }) {
                Icon(UniVerseSymbols.ellipsis, null, tint = Palette.formAccent.resolve(dark))
            }
            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                Text(
                    stringResource(R.string.tabs_archive_inactive_tabs),
                    style = UniVerseType.footnote,
                    color = SystemPalette.secondaryLabel.resolve(dark),
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
                )
                for (option in AutoArchiveInterval.entries) {
                    MenuRow(option.title, if (option == interval) UniVerseSymbols.checkmark else null) {
                        menu = false
                        choose(option)
                    }
                }
                HorizontalDivider()
                MenuRow(stringResource(R.string.archive_delete_all_menu), UniVerseSymbols.trash, destructive = true, enabled = canDelete) {
                    menu = false
                    deleteAll()
                }
            }
        }
    }
}

@Composable
private fun ArchiveSearchField(query: String, onChange: (String) -> Unit) {
    val dark = LocalUniVerseDarkTheme.current
    val prompt = stringResource(R.string.archive_search_prompt)
    val secondary = SystemPalette.secondaryLabel.resolve(dark)
    Row(
        Modifier
            .padding(horizontal = Spacing.page, vertical = Spacing.tight)
            .fillMaxWidth()
            .heightIn(min = 40.dp)
            .background(BrowsePalette.fieldFill.resolve(dark), RoundedCornerShape(12.dp))
            .padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(UniVerseSymbols.magnifyingglass, null, Modifier.size(17.dp), tint = secondary)
        Box(Modifier.weight(1f).padding(vertical = 8.dp)) {
            if (query.isEmpty()) Text(prompt, style = UniVerseType.body, color = secondary, maxLines = 1)
            BasicTextField(
                value = query,
                onValueChange = onChange,
                singleLine = true,
                textStyle = UniVerseType.body.copy(color = SystemPalette.label.resolve(dark)),
                cursorBrush = SolidColor(Palette.formAccent.resolve(dark)),
                modifier = Modifier.fillMaxWidth().semantics { contentDescription = prompt }.testTag(ARCHIVE_SEARCH_TAG),
            )
        }
        if (query.isNotEmpty()) {
            val clear = stringResource(R.string.archive_clear_search)
            Icon(
                UniVerseSymbols.xmarkCircleFill,
                clear,
                Modifier.size(32.dp).clickable(onClickLabel = clear) { onChange("") }.padding(7.dp),
                tint = secondary,
            )
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ArchiveDays(model: AppModel, haptics: Haptics) {
    val days = model.archive
    val today = remember { LocalDate.now() }
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom).asPaddingValues(),
    ) {
        for (day in days) {
            stickyHeader(key = "day:${day.day}") { ArchiveDayHeader(day.day, today) }
            items(day.tabs, key = { it.id }) { tab -> ArchiveRowItem(model, tab, haptics) }
        }
    }
}

@Composable
private fun ArchiveResults(model: AppModel, query: String, haptics: Haptics) {
    val revision = model.archive
    var results by remember { mutableStateOf<List<BrowserTab>?>(null) }
    LaunchedEffect(query, revision) {
        delay(SEARCH_DEBOUNCE_MILLIS)
        results = runCatching { model.searchArchive(query) }.getOrDefault(emptyList())
    }
    val found = results ?: return
    if (found.isEmpty()) {
        ArchiveNoResults(query)
        return
    }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom).asPaddingValues()) {
        items(found, key = { it.id }) { tab -> ArchiveRowItem(model, tab, haptics) }
    }
}

@Composable
private fun ArchiveDayHeader(day: LocalDate, today: LocalDate) {
    val dark = LocalUniVerseDarkTheme.current
    val locale = LocalConfiguration.current.locales[0] ?: Locale.getDefault()
    val label = when (val kind = ArchiveDayLabel.of(day, today)) {
        ArchiveDayLabel.Today -> stringResource(R.string.archive_today)
        ArchiveDayLabel.Yesterday -> stringResource(R.string.archive_yesterday)
        is ArchiveDayLabel.Weekday -> kind.day.dayOfWeek.getDisplayName(TextStyle.FULL, locale)
        is ArchiveDayLabel.MonthDay -> kind.day.format(DateTimeFormatter.ofPattern(DateFormat.getBestDateTimePattern(locale, "MMMMd"), locale))
        is ArchiveDayLabel.MonthDayYear -> kind.day.format(DateTimeFormatter.ofPattern(DateFormat.getBestDateTimePattern(locale, "yMMMMd"), locale))
    }
    Text(
        label,
        style = UniVerseType.subheadline.semibold,
        color = SystemPalette.secondaryLabel.resolve(dark),
        modifier = Modifier
            .fillMaxWidth()
            .background(LocalProfileLook.current.surface.resolve(dark).copy(alpha = 0.92f))
            .padding(horizontal = Spacing.page, vertical = 6.dp)
            .semantics { heading() },
    )
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ArchiveRowItem(model: AppModel, tab: BrowserTab, haptics: Haptics) {
    val dark = LocalUniVerseDarkTheme.current
    var menu by remember { mutableStateOf(false) }
    val restore = {
        haptics.selection()
        model.restoreArchived(tab.id)
    }
    val delete = { model.deleteArchived(setOf(tab.id)) }
    val swipe = rememberSwipeToDismissBoxState()
    val hint = stringResource(R.string.archive_row_hint)
    SwipeToDismissBox(
        state = swipe,
        enableDismissFromStartToEnd = false,
        onDismiss = { value -> if (value == SwipeToDismissBoxValue.EndToStart) delete() },
        backgroundContent = {
            Box(
                Modifier.fillMaxSize().background(SystemPalette.red.resolve(dark)).padding(horizontal = 20.dp),
                contentAlignment = Alignment.CenterEnd,
            ) {
                Icon(UniVerseSymbols.trash, stringResource(R.string.archive_delete), tint = Color.White)
            }
        },
    ) {
        Box {
            ArchiveRow(
                tab,
                Modifier
                    .background(LocalProfileLook.current.surface.resolve(dark))
                    .combinedClickable(onClickLabel = hint, onLongClick = { menu = true }, onClick = restore),
            )
            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                MenuRow(stringResource(R.string.archive_open), UniVerseSymbols.arrowUpForwardSquare) {
                    menu = false
                    model.restoreArchived(tab.id)
                }
                if (model.shareUrl(tab) != null) {
                    MenuRow(stringResource(R.string.tabs_copy_link), UniVerseSymbols.link) {
                        menu = false
                        model.copyLink(tab)
                        haptics.success()
                    }
                    MenuRow(stringResource(R.string.tabs_share), UniVerseSymbols.squareAndArrowUp) {
                        menu = false
                        model.share(tab)
                    }
                }
                HorizontalDivider()
                MenuRow(stringResource(R.string.archive_delete), UniVerseSymbols.trash, destructive = true) {
                    menu = false
                    delete()
                }
            }
        }
    }
}

@Composable
private fun ArchiveRow(tab: BrowserTab, modifier: Modifier = Modifier) {
    val dark = LocalUniVerseDarkTheme.current
    val context = LocalContext.current
    val fontScale = LocalDensity.current.fontScale
    val newTab = stringResource(R.string.tabs_new_tab)
    val host = TabText.host(tab, newTab)
    val time = tab.archivedAt?.let { remember(it) { DateFormat.getTimeFormat(context).format(Date(it)) } }
    val facts = if (time == null) host else stringResource(R.string.archive_facts, host, time)
    Row(
        modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp)
            .padding(horizontal = Spacing.page, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        FaviconImage(tab.faviconUrl, tab.url, Modifier.padding(top = 2.dp), size = (20 * fontScale.coerceAtMost(2f)).dp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                TabText.title(tab, newTab),
                style = UniVerseType.body,
                color = SystemPalette.label.resolve(dark),
                maxLines = if (fontScale >= LARGE_FONT_SCALE) Int.MAX_VALUE else 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(facts, style = UniVerseType.subheadline, color = SystemPalette.secondaryLabel.resolve(dark), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun ArchiveEmptyState(modifier: Modifier = Modifier) {
    val dark = LocalUniVerseDarkTheme.current
    Column(
        modifier.widthIn(max = 320.dp).padding(Spacing.large),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        ArchiveTile(64.dp)
        Spacer(Modifier.size(2.dp))
        Text(stringResource(R.string.archive_empty_title), style = UniVerseType.title2.semibold, color = SystemPalette.label.resolve(dark), textAlign = TextAlign.Center)
        Text(stringResource(R.string.archive_empty_message), style = UniVerseType.subheadline, color = SystemPalette.secondaryLabel.resolve(dark), textAlign = TextAlign.Center)
    }
}

@Composable
private fun ArchiveNoResults(query: String) {
    val dark = LocalUniVerseDarkTheme.current
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            Modifier.widthIn(max = 320.dp).padding(Spacing.large),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Icon(UniVerseSymbols.magnifyingglass, null, Modifier.size(44.dp), tint = SystemPalette.secondaryLabel.resolve(dark))
            Text(stringResource(R.string.archive_no_results, query), style = UniVerseType.title2.semibold, color = SystemPalette.label.resolve(dark), textAlign = TextAlign.Center)
            Text(stringResource(R.string.archive_no_results_message), style = UniVerseType.subheadline, color = SystemPalette.secondaryLabel.resolve(dark), textAlign = TextAlign.Center)
        }
    }
}

const val ARCHIVE_TAG = "tabs.archive"
const val ARCHIVE_SEARCH_TAG = "tabs.archive.search"
private const val SEARCH_DEBOUNCE_MILLIS = 120L
internal const val LARGE_FONT_SCALE = 1.5f
