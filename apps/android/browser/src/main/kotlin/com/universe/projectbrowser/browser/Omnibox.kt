package com.universe.projectbrowser

import com.universe.projectbrowser.shared.ScriptEngine
import com.universe.projectbrowser.shared.SharedScript
import org.json.JSONObject

class Omnibox(private val script: ScriptEngine) {
    data class Resolution(val kind: String, val url: String, val query: String, val engine: String)

    fun resolve(text: String): Resolution? {
        val json = script.call(SharedScript.CORE, "mobileResolve", listOf(JSONObject.quote(text)))
        if (json == "null") return null
        val value = JSONObject(json)
        return Resolution(value.getString("kind"), value.getString("url"), value.getString("query"), value.getString("engine"))
    }
}
