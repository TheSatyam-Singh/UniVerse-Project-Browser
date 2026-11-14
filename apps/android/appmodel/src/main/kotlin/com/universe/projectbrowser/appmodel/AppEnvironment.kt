package com.universe.projectbrowser.appmodel

import android.content.Context
import com.universe.projectbrowser.blocking.BlockingStore
import com.universe.projectbrowser.blocking.FilterLists
import com.universe.projectbrowser.blocking.HttpFilterListDownloader
import com.universe.projectbrowser.blocking.InMemoryBlockingStore
import com.universe.projectbrowser.blocking.SharedPreferencesBlockingStore
import com.universe.projectbrowser.SystemWebViewEngine
import com.universe.projectbrowser.PageEngine
import com.universe.projectbrowser.SitePreferences
import com.universe.projectbrowser.store.BrowserStore
import com.universe.projectbrowser.store.CoreScript
import com.universe.projectbrowser.store.HermesCoreScript
import com.universe.projectbrowser.store.KeyValueStore
import com.universe.projectbrowser.store.MemoryKeyValueStore
import com.universe.projectbrowser.store.SharedPreferencesStore
import com.universe.projectbrowser.sync.SyncController
import java.io.File
import kotlin.concurrent.thread
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers

class AppEnvironment(
    val isDemo: Boolean,
    val preferences: KeyValueStore,
    val blockingStore: BlockingStore,
    val openStore: suspend () -> BrowserStore,
    val makeEngine: (SitePreferences) -> PageEngine,
    val makeSync: () -> SyncController,
    val makeFilterLists: (BlockingStore) -> FilterLists,
    val coreScript: () -> CoreScript,
    val omniboxDirectory: File?,
    val system: SystemActions,
    val workDispatcher: CoroutineDispatcher = Dispatchers.Default,
) {
    val refreshesFromNetwork: Boolean get() = !isDemo

    companion object {
        const val BLOCKING_PREFERENCES = "universe.blocking"
        const val BLOCKING_FOLDER = "Blocking"
        const val DEMO_BLOCKING_FOLDER = "DemoBlocking"

        fun preloadPreferences(context: Context): Thread {
            val app = context.applicationContext
            return thread(name = "ArdiaPreferences", isDaemon = true) {
                app.getSharedPreferences(BrowserStore.PREFERENCES_NAME, Context.MODE_PRIVATE).all
                app.getSharedPreferences(BLOCKING_PREFERENCES, Context.MODE_PRIVATE).all
            }
        }

        fun forApp(context: Context, isDemo: Boolean): AppEnvironment {
            val app = context.applicationContext
            val system = AndroidSystemActions(app)
            if (isDemo) {
                return AppEnvironment(
                    isDemo = true,
                    preferences = MemoryKeyValueStore(),
                    blockingStore = InMemoryBlockingStore(),
                    openStore = { BrowserStore.demo(app) },
                    makeEngine = { preferences -> SystemWebViewEngine(app, preferences) },
                    makeSync = { SyncController.demo() },
                    makeFilterLists = { store -> FilterLists.demo(File(File(app.cacheDir, DEMO_BLOCKING_FOLDER), "Filters"), store) },
                    coreScript = { HermesCoreScript(app.assets) },
                    omniboxDirectory = null,
                    system = system,
                )
            }
            return AppEnvironment(
                isDemo = false,
                preferences = SharedPreferencesStore(app.getSharedPreferences(BrowserStore.PREFERENCES_NAME, Context.MODE_PRIVATE)),
                blockingStore = SharedPreferencesBlockingStore(app.getSharedPreferences(BLOCKING_PREFERENCES, Context.MODE_PRIVATE)),
                openStore = { BrowserStore.open(app) },
                makeEngine = { preferences -> SystemWebViewEngine(app, preferences) },
                makeSync = { SyncController.forApp(app) },
                makeFilterLists = { store -> FilterLists(File(File(app.cacheDir, BLOCKING_FOLDER), "Filters"), store, HttpFilterListDownloader()) },
                coreScript = { HermesCoreScript(app.assets) },
                omniboxDirectory = BrowserStore.omniboxDirectory(app),
                system = system,
            )
        }
    }
}
