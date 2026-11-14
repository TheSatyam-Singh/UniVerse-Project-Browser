package com.universe.projectbrowser.android

import android.app.Application
import android.content.Context
import android.content.pm.ApplicationInfo
import com.universe.projectbrowser.appmodel.AppModel
import com.universe.projectbrowser.appmodel.AppEnvironment
import com.universe.projectbrowser.appmodel.LaunchArguments
import com.universe.projectbrowser.sync.SyncController
import com.universe.projectbrowser.sync.SyncControllerOwner
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

class UniVerseApplication : Application(), SyncControllerOwner {
    val appScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val lock = Any()

    @Volatile
    private var current: AppModel? = null

    override fun onCreate() {
        super.onCreate()
        AppEnvironment.preloadPreferences(this)
        StartupTiming.applicationCreated()
    }

    val existingModel: AppModel? get() = current

    val acceptsLaunchArguments: Boolean get() = applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0

    fun model(launch: LaunchArguments = LaunchArguments.none): AppModel = synchronized(lock) {
        val made = current
        if (made != null && (launch == LaunchArguments.none || launch == made.launch)) return made
        made?.close()
        AppModel(launch, AppEnvironment.forApp(this, launch.isDemo)).also { current = it }
    }

    fun discardModel() {
        synchronized(lock) {
            current?.close()
            current = null
        }
    }

    override val syncController: SyncController get() = model().sync

    companion object {
        fun of(context: Context): UniVerseApplication = context.applicationContext as UniVerseApplication
    }
}
