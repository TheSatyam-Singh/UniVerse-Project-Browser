package com.universe.projectbrowser.settings

import androidx.compose.runtime.Immutable
import com.universe.projectbrowser.store.SearchEngineInfo
import com.universe.projectbrowser.sync.SyncedSearch
import java.util.Locale

@Immutable
data class EngineChoice(val id: String, val name: String)

object SearchEngineNames {
    const val CUSTOM_ID = "custom"

    val fallback: List<EngineChoice> = listOf(
        EngineChoice("google", "Google"),
        EngineChoice("bing", "Bing"),
        EngineChoice("duckduckgo", "DuckDuckGo"),
        EngineChoice("ecosia", "Ecosia"),
        EngineChoice("brave", "Brave Search"),
        EngineChoice("kagi", "Kagi"),
        EngineChoice("startpage", "Startpage"),
        EngineChoice("yahoo", "Yahoo"),
    )

    fun choices(loaded: List<SearchEngineInfo>): List<EngineChoice> {
        val builtIn = loaded.filter { it.custom != true }.map { EngineChoice(it.id, it.name) }
        return builtIn.ifEmpty { fallback }
    }

    fun name(id: String, engines: List<EngineChoice> = fallback): String =
        engines.firstOrNull { it.id == id }?.name
            ?: fallback.firstOrNull { it.id == id }?.name
            ?: id.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.getDefault()) else it.toString() }

    fun name(synced: SyncedSearch, customTitle: String, engines: List<EngineChoice> = fallback): String {
        synced.customEngines.firstOrNull { it.id == synced.engineId }?.let { return it.name }
        if (synced.engineId == CUSTOM_ID) return customTitle
        return name(synced.engineId, engines)
    }

    fun current(syncEnabled: Boolean, synced: SyncedSearch?, localId: String, customTitle: String): String =
        if (syncEnabled && synced != null) name(synced, customTitle) else name(localId)
}
