package com.universe.projectbrowser.appmodel

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.universe.projectbrowser.store.CandidateTab
import com.universe.projectbrowser.store.CompletionOffer
import com.universe.projectbrowser.store.Omnibox
import com.universe.projectbrowser.store.OmniboxContext
import com.universe.projectbrowser.store.OmniboxModel
import com.universe.projectbrowser.store.OmniboxResolution
import com.universe.projectbrowser.store.OmniboxResult
import com.universe.projectbrowser.store.SearchSuggestion
import com.universe.projectbrowser.store.SearchSuggestions
import com.universe.projectbrowser.store.SyncedBrowsing
import com.universe.projectbrowser.store.TabStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

@Stable
class SearchSuggestionsModel internal constructor(
    source: Omnibox,
    parent: CoroutineScope,
    private val tabs: suspend () -> TabStore,
    private val synced: SyncedBrowsing?,
    private val recentQueries: () -> List<String>,
    fetchesNetworkSuggestions: Boolean,
    currentUrl: String?,
    currentTabId: String?,
) {
    private val scope = CoroutineScope(parent.coroutineContext + SupervisorJob(parent.coroutineContext[Job]))
    val omnibox = OmniboxModel(source, scope).apply {
        context = OmniboxContext(currentUrl = currentUrl, currentTabId = currentTabId)
        this.fetchesNetworkSuggestions = fetchesNetworkSuggestions
    }

    var text: String by mutableStateOf("")
        private set
    var result: OmniboxResult by mutableStateOf(OmniboxResult.empty)
        private set

    init {
        scope.launch { omnibox.result.collect { result = it } }
    }

    val completion: CompletionOffer? get() = result.completion

    val rows: List<SearchSuggestion> get() = SearchSuggestions.rows(text, result, synced, recentQueries())

    fun prepare(): Job = scope.launch {
        val tabs = tabs()
        val open = tabs.openTabs.map { CandidateTab(it.id, it.url, it.title, it.faviconUrl) }
        omnibox.refreshCandidates(open, { limit -> tabs.history.summary(limit) }, synced).join()
    }

    fun update(newText: String) {
        if (newText == text) return
        text = newText
        if (newText.isBlank()) omnibox.clear() else omnibox.update(newText)
    }

    fun cancel() {
        omnibox.clear()
    }

    suspend fun resolve(submitted: String): OmniboxResolution? = omnibox.resolve(submitted)

    fun close() {
        omnibox.close()
        scope.cancel()
    }
}
