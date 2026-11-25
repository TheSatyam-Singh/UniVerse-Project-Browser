package com.universe.projectbrowser.appmodel

import com.universe.projectbrowser.blocking.ContentBlocker
import com.universe.projectbrowser.NightShadeMode as PageNightShade
import com.universe.projectbrowser.PageFilter
import com.universe.projectbrowser.SitePreferences
import com.universe.projectbrowser.VisitKind
import com.universe.projectbrowser.store.AppLinkPreference
import com.universe.projectbrowser.store.BrowsingPreferences
import com.universe.projectbrowser.store.CandidateBookmark
import com.universe.projectbrowser.store.CustomSearchEngine
import com.universe.projectbrowser.store.HistoryRow
import com.universe.projectbrowser.store.IncomingTab
import com.universe.projectbrowser.store.NightShadeMode
import com.universe.projectbrowser.store.SearchChoice
import com.universe.projectbrowser.store.SyncBrowsingSource
import com.universe.projectbrowser.store.SyncedBrowsing
import com.universe.projectbrowser.store.VisitTransition
import com.universe.projectbrowser.sync.BookmarkItem
import com.universe.projectbrowser.sync.LocalBrowsingSource
import com.universe.projectbrowser.sync.LocalTabRecord
import com.universe.projectbrowser.sync.LocalVisitRecord
import com.universe.projectbrowser.sync.ReceivedTab
import com.universe.projectbrowser.sync.SyncSnapshot
import com.universe.projectbrowser.sync.SyncedDevice
import com.universe.projectbrowser.sync.SyncedSearch

class StoreSitePreferences(private val preferences: BrowsingPreferences) : SitePreferences {
    override fun nightShade(host: String?, isPrivate: Boolean): PageNightShade = pageMode(preferences.current.nightShade(host, isPrivate))

    override fun pageZoom(host: String?, isPrivate: Boolean): Double? = preferences.current.site(host, isPrivate).pageZoom

    override fun setPageZoom(host: String, isPrivate: Boolean, zoom: Double?) {
        preferences.updateSite(host, isPrivate) { it.copy(pageZoom = zoom?.takeIf { value -> value != 1.0 }) }
    }

    override fun opensLinksInApps(host: String?, isPrivate: Boolean): Boolean = preferences.current.appLinks(host, isPrivate) == AppLinkPreference.APP

    companion object {
        fun pageMode(mode: NightShadeMode): PageNightShade = when (mode) {
            NightShadeMode.DISABLED -> PageNightShade.Disabled
            NightShadeMode.AUTOMATIC -> PageNightShade.Automatic
            NightShadeMode.ALWAYS -> PageNightShade.Always
        }
    }
}

class BlockingPageFilter(private val isPrivate: Boolean, private val blocker: () -> ContentBlocker?) : PageFilter {
    private var madeFor: ContentBlocker? = null
    private var made: com.universe.projectbrowser.blocking.PageFilter? = null

    private fun filter(): com.universe.projectbrowser.blocking.PageFilter? {
        val current = blocker() ?: return null
        synchronized(this) {
            if (madeFor !== current) {
                made = current.pageFilter(isPrivate)
                madeFor = current
            }
            return made
        }
    }

    override fun blocks(requestUrl: String, pageUrl: String?, isMainFrame: Boolean): Boolean =
        filter()?.blocks(requestUrl, pageUrl, isMainFrame) ?: false

    override fun scriptsAtDocumentStart(pageUrl: String): List<String> = filter()?.scriptsAtDocumentStart(pageUrl).orEmpty()

    override fun scriptsAtDocumentEnd(pageUrl: String): List<String> = filter()?.scriptsAtDocumentEnd(pageUrl).orEmpty()
}

class StoreSyncSource(private val source: SyncBrowsingSource) : LocalBrowsingSource {
    override fun syncedTabs(): List<LocalTabRecord> = source.syncedTabs().map { LocalTabRecord(it.url, it.title, it.lastActive, it.profileSyncId) }

    override fun syncedVisits(since: Long): List<LocalVisitRecord> = source.syncedVisits(since).map(::record)

    override fun syncedVisits(urls: Set<String>): List<LocalVisitRecord> = source.syncedVisits(urls).map(::record)

    override fun removeVisits(urls: Set<String>, profileSyncId: String?) = source.removeVisits(urls, profileSyncId)

    override fun receive(tabs: List<ReceivedTab>): Boolean = source.receive(tabs.map(::incoming))

    private fun record(visit: com.universe.projectbrowser.store.VisitRecord) = LocalVisitRecord(visit.url, visit.title, visit.visitedAt, visit.profileSyncId)

    companion object {
        fun incoming(tab: ReceivedTab) = IncomingTab(tab.key, tab.url, tab.title, tab.fromDevice, tab.sentAt, tab.profileSyncId, tab.fromDeviceId)
    }
}

object SyncedData {
    fun searchChoice(search: SyncedSearch?): SearchChoice? = search?.let { synced ->
        SearchChoice(
            engineId = synced.engineId,
            customUrl = synced.customURL,
            customEngines = synced.customEngines.map { CustomSearchEngine(it.id, it.name, it.keyword, it.url) },
        )
    }

    fun browsing(snapshot: SyncSnapshot, profileSyncId: String?): SyncedBrowsing? {
        val profile = snapshot.profile(profileSyncId) ?: return null
        val currentDevices = snapshot.devices.filter { it.isCurrent }.map { it.id }.toSet()
        val bookmarks = ArrayList<CandidateBookmark>()
        fun walk(items: List<BookmarkItem>) {
            for (item in items) {
                item.url?.let { bookmarks.add(CandidateBookmark(it, item.title)) }
                item.children?.let(::walk)
            }
        }
        walk(profile.bookmarks)
        for (tile in profile.pinned.tiles) {
            bookmarks.add(CandidateBookmark(tile.url, tile.title, tile.icon))
            tile.folder.orEmpty().forEach { bookmarks.add(CandidateBookmark(it.url, it.title, it.icon)) }
        }
        return SyncedBrowsing(
            history = profile.history.map { HistoryRow(it.url, it.title, null, it.visits, it.lastVisit) },
            deviceTabs = profile.deviceTabs.map { device ->
                SyncedBrowsing.DeviceTabs(
                    deviceId = device.deviceId,
                    deviceName = device.deviceName,
                    isMac = device.kind == SyncedDevice.MAC,
                    isCurrent = device.deviceId in currentDevices,
                    tabs = device.tabs.map { SyncedBrowsing.RemoteTab(it.url, it.title) },
                )
            },
            bookmarks = bookmarks,
            syncedAt = snapshot.syncedAt,
        )
    }
}

object VisitKinds {
    fun transition(kind: VisitKind): VisitTransition? = when (kind) {
        VisitKind.Typed -> VisitTransition.TYPED
        VisitKind.Link, VisitKind.SameDocument -> VisitTransition.LINK
        VisitKind.BackForward -> VisitTransition.BACK_FORWARD
        VisitKind.Redirect -> VisitTransition.OTHER
        VisitKind.Restored -> null
    }
}
