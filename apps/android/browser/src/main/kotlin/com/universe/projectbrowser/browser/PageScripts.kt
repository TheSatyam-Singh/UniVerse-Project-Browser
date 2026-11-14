package com.universe.projectbrowser

import android.content.res.AssetManager

object PageScripts {
    const val BRIDGE_NAME = "ardiaPage"
    const val NIGHT_SHADE_MESSAGE = "nightShade"

    fun mainFrameOnly(script: String): String = "if (window === window.top) {\n$script\n}"

    fun filterBundle(start: List<String>, end: List<String>): String? {
        if (start.isEmpty() && end.isEmpty()) return null
        val builder = StringBuilder("(() => {\nif (window !== window.top) return;\n")
        for (script in start) builder.append("try {\n").append(script).append("\n} catch (error) {}\n")
        if (end.isNotEmpty()) {
            builder.append("const runAtDocumentEnd = () => {\n")
            for (script in end) builder.append("try {\n").append(script).append("\n} catch (error) {}\n")
            builder.append("};\n")
            builder.append("if (document.readyState === \"loading\") document.addEventListener(\"DOMContentLoaded\", runAtDocumentEnd, { once: true });\n")
            builder.append("else runAtDocumentEnd();\n")
        }
        return builder.append("})();").toString()
    }

    fun nightShadeCall(mode: NightShadeMode): String = "window.__universeNightShade && window.__universeNightShade(\"${mode.raw}\")"

    fun readerCall(readerScript: String): String = "(() => {\n$readerScript\n})()"

    fun decodeEvaluationResult(result: String?): String? {
        if (result == null || result == "null" || result == "undefined") return null
        return runCatching { org.json.JSONTokener(result).nextValue() as? String }.getOrNull()
    }
}

internal class PageScriptSources(private val assets: AssetManager) {
    val nightShade: String by lazy { read("night-shade.js") }
    val reader: String by lazy { read("readable-content.js") }
    val pageLook: String by lazy { read("page-look.js") }
    val sponsorBlock: String by lazy { read("sponsorblock.js") }
    val youTubeTweaks: String by lazy { read("youtube-tweaks.js") }

    fun preload() {
        nightShade
        pageLook
        reader
        sponsorBlock
        youTubeTweaks
    }

    private fun read(name: String): String = assets.open("universe-browser/$name").bufferedReader().use { it.readText() }
}
