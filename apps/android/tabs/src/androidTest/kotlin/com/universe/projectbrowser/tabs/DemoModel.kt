package com.universe.projectbrowser.tabs

import androidx.compose.runtime.Composable
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.test.core.app.ApplicationProvider
import androidx.test.platform.app.InstrumentationRegistry
import com.universe.projectbrowser.appmodel.AppEnvironment
import com.universe.projectbrowser.appmodel.AppModel
import com.universe.projectbrowser.appmodel.LaunchArguments
import com.universe.projectbrowser.design.UniVerseTheme

class DemoModel(private val compose: ComposeContentTestRule) {
    lateinit var model: AppModel
        private set

    fun start() {
        InstrumentationRegistry.getInstrumentation().runOnMainSync {
            model = AppModel(LaunchArguments(isDemo = true), AppEnvironment.forApp(ApplicationProvider.getApplicationContext(), isDemo = true))
        }
        compose.waitUntil(TIMEOUT) { model.isReady }
    }

    fun show(content: @Composable (AppModel) -> Unit) {
        compose.setContent {
            UniVerseTheme(darkTheme = false, look = model.look, reduceMotion = false, reduceTransparency = true) { content(model) }
        }
    }

    fun close() {
        InstrumentationRegistry.getInstrumentation().runOnMainSync { model.close() }
    }

    fun <T> onMain(work: () -> T): T {
        var result: Result<T>? = null
        InstrumentationRegistry.getInstrumentation().runOnMainSync { result = runCatching(work) }
        return result!!.getOrThrow()
    }

    companion object {
        const val TIMEOUT = 20_000L
    }
}
