package com.universe.projectbrowser.android.share

import android.content.ActivityNotFoundException
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.remember
import com.universe.projectbrowser.android.UniVerseApplication
import com.universe.projectbrowser.android.SystemIntents
import com.universe.projectbrowser.android.system.SystemDevice
import com.universe.projectbrowser.android.system.SystemStore
import com.universe.projectbrowser.design.UniVerseTheme

class ShareActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val page = sharedPage(intent)
        val snapshot = SystemStore.shared(this).loadSnapshot()
        val app = UniVerseApplication.of(this)
        setContent {
            val model = remember {
                ShareSheetModel(
                    page = page,
                    snapshot = snapshot,
                    scope = app.appScope,
                    open = ::openInMain,
                    send = { shared, device -> sendFromShare(app, shared, device) },
                    finish = ::finish,
                    cancel = ::finish,
                )
            }
            UniVerseTheme(darkTheme = isSystemInDarkTheme(), look = snapshot.look) {
                ShareSheetView(model)
            }
        }
    }

    private fun openInMain(uri: String): Boolean = try {
        startActivity(SystemIntents.main(this, uri))
        true
    } catch (missing: ActivityNotFoundException) {
        false
    }

    companion object {
        suspend fun sendFromShare(app: UniVerseApplication, page: SharedPage, device: SystemDevice): Boolean {
            val url = page.url ?: return false
            return app.model().sendFromShare(url, page.displayTitle, device.id)
        }

        fun sharedPage(intent: Intent?): SharedPage {
            val text = intent?.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()
            val subject = intent?.getStringExtra(Intent.EXTRA_SUBJECT) ?: intent?.getStringExtra(Intent.EXTRA_TITLE)
            return SharedPage.from(text, subject)
        }
    }
}
