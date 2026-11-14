package com.universe.projectbrowser.browsing

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.universe.projectbrowser.appmodel.AppModel
import com.universe.projectbrowser.appmodel.BrowseSession
import com.universe.projectbrowser.design.UniVerseType
import com.universe.projectbrowser.design.SystemPalette
import com.universe.projectbrowser.store.BrowserUrl

@Composable
internal fun LinkPreviewDialog(model: AppModel, preview: BrowseSession.LinkPreview, tabId: String) {
    val page = preview.page
    val host = BrowserUrl.host(preview.url) ?: preview.url
    val dismiss = model::dismissLinkPreview
    AlertDialog(
        onDismissRequest = dismiss,
        title = {
            Text(
                page?.title ?: host,
                style = UniVerseType.headline,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                Text(
                    host,
                    style = UniVerseType.footnote,
                    color = SystemPalette.secondaryLabel.current,
                    modifier = Modifier.padding(bottom = 8.dp),
                )
                when {
                    preview.isLoading -> Text(stringResource(R.string.browsing_preview_loading), style = UniVerseType.body)
                    page == null -> Text(stringResource(R.string.browsing_preview_failed), style = UniVerseType.body)
                    else -> Text(page.description ?: page.text.take(PREVIEW_TEXT_LIMIT), style = UniVerseType.body)
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    dismiss()
                    model.openLink(preview.url, tabId, inBackground = false)
                },
                modifier = Modifier.testTag(BrowsingTags.PREVIEW_OPEN),
            ) { Text(stringResource(R.string.browsing_preview_open)) }
        },
        dismissButton = {
            TextButton(onClick = dismiss) { Text(stringResource(R.string.browsing_cancel)) }
        },
    )
}

private const val PREVIEW_TEXT_LIMIT = 500
