package com.universe.projectbrowser

import java.io.IOException
import java.net.URLEncoder
import java.security.MessageDigest
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject

enum class SponsorBlockSkipOption(val raw: String) {
    AUTO("auto"),
    MANUAL("manual"),
    DISABLED("disabled");

    companion object {
        fun of(raw: String?): SponsorBlockSkipOption = entries.firstOrNull { it.raw == raw } ?: DISABLED
    }
}

object SponsorBlockCategories {
    const val SPONSOR = "sponsor"
    const val SELF_PROMO = "selfpromo"
    const val EXCLUSIVE_ACCESS = "exclusive_access"
    const val INTERACTION = "interaction"
    const val INTRO = "intro"
    const val OUTRO = "outro"
    const val PREVIEW = "preview"
    const val FILLER = "filler"
    const val MUSIC_OFFTOPIC = "music_offtopic"
    const val POI_HIGHLIGHT = "poi_highlight"

    val ALL: List<String> = listOf(SPONSOR, SELF_PROMO, EXCLUSIVE_ACCESS, INTERACTION, INTRO, OUTRO, PREVIEW, FILLER, MUSIC_OFFTOPIC, POI_HIGHLIGHT)

    val DEFAULT_OPTIONS: Map<String, String> = ALL.associateWith { category ->
        when (category) {
            SPONSOR -> SponsorBlockSkipOption.AUTO.raw
            POI_HIGHLIGHT -> SponsorBlockSkipOption.MANUAL.raw
            else -> SponsorBlockSkipOption.DISABLED.raw
        }
    }
}

data class SponsorBlockOptions(val enabled: Boolean, val categories: Map<String, String> = emptyMap()) {
    val effectiveCategories: Map<String, String> get() = if (categories.isEmpty()) SponsorBlockCategories.DEFAULT_OPTIONS else categories

    val activeCategories: Set<String> get() =
        if (!enabled) emptySet() else effectiveCategories.filter { SponsorBlockSkipOption.of(it.value) != SponsorBlockSkipOption.DISABLED }.keys

    fun optionsJson(): String {
        val json = JSONObject()
        for ((category, option) in effectiveCategories) json.put(category, option)
        return json.toString()
    }

    companion object {
        val DISABLED = SponsorBlockOptions(false)
    }
}

data class YouTubeTweaksOptions(val hideShorts: Boolean = false, val frameThumbnails: Boolean = false, val noHoverPreview: Boolean = false) {
    val isEmpty: Boolean get() = !hideShorts && !frameThumbnails && !noHoverPreview

    companion object {
        val DISABLED = YouTubeTweaksOptions()
    }
}

data class SponsorBlockSegment(val uuid: String, val category: String, val segment: List<Double>, val actionType: String)

object SponsorBlock {
    const val API_BASE = "https://sponsor.ajay.app/api"
    const val MAX_SEGMENT_END_SECONDS = 86_400.0

    private val videoIdPatterns = listOf(
        Regex("[?&]v=([A-Za-z0-9_-]{11})"),
        Regex("/(?:embed|v|shorts)/([A-Za-z0-9_-]{11})"),
        Regex("youtu\\.be/([A-Za-z0-9_-]{11})"),
    )

    fun isYouTubeHost(host: String?): Boolean {
        val normalized = host?.lowercase()?.removePrefix("www.") ?: return false
        return normalized == "youtube.com" || normalized == "youtu.be" || normalized.endsWith(".youtube.com")
    }

    fun videoId(url: String?): String? {
        if (url.isNullOrEmpty()) return null
        for (pattern in videoIdPatterns) {
            pattern.find(url)?.let { return it.groupValues[1] }
        }
        return null
    }

    fun sha256HexPrefix(videoId: String, length: Int = 4): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(videoId.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }.take(length)
    }

    fun segmentsUrl(videoId: String, categories: Set<String>): String {
        val json = JSONArray().apply { categories.sorted().forEach { put(it) } }.toString()
        val encoded = URLEncoder.encode(json, "UTF-8")
        return "$API_BASE/skipSegments/${sha256HexPrefix(videoId)}?categories=$encoded"
    }

    fun parseHashResponse(body: String, videoId: String, enabledCategories: Set<String>): List<SponsorBlockSegment> {
        val fullHash = MessageDigest.getInstance("SHA-256").digest(videoId.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
        val responses = runCatching { JSONArray(body) }.getOrNull() ?: return emptyList()
        for (index in 0 until responses.length()) {
            val entry = responses.optJSONObject(index) ?: continue
            val entryVideoId = entry.optString("videoID").takeIf { it.isNotEmpty() } ?: continue
            val entryHash = entry.optString("hash").takeIf { it.isNotEmpty() }
            if (entryVideoId != videoId && entryHash != fullHash) continue
            val segments = entry.optJSONArray("segments") ?: return emptyList()
            val kept = ArrayList<SponsorBlockSegment>()
            for (item in 0 until segments.length()) {
                val segment = segments.optJSONObject(item) ?: continue
                val range = segment.optJSONArray("segment") ?: continue
                if (range.length() != 2) continue
                val start = range.optDouble(0, Double.NaN)
                val end = range.optDouble(1, Double.NaN)
                if (start.isNaN() || end.isNaN() || start < 0 || start >= end || end >= MAX_SEGMENT_END_SECONDS) continue
                val category = segment.optString("category").takeIf { it.isNotEmpty() } ?: continue
                if (category !in enabledCategories) continue
                val action = segment.optString("actionType").takeIf { it.isNotEmpty() } ?: continue
                if (action != "skip" && action != "mute") continue
                kept += SponsorBlockSegment(
                    uuid = segment.optString("UUID").takeIf { it.isNotEmpty() } ?: continue,
                    category = category,
                    segment = listOf(start, end),
                    actionType = action,
                )
            }
            return kept.sortedBy { it.segment[0] }
        }
        return emptyList()
    }

    fun deliveryScript(segments: List<SponsorBlockSegment>, options: SponsorBlockOptions): String {
        val json = JSONArray()
        for (segment in segments) {
            json.put(JSONObject().apply {
                put("UUID", segment.uuid)
                put("category", segment.category)
                put("segment", JSONArray().apply { put(segment.segment[0]); put(segment.segment[1]) })
                put("actionType", segment.actionType)
            })
        }
        return "window.__nookSponsorBlock?.receiveSegments($json, ${options.optionsJson()})"
    }

    fun youTubeTweaksCss(hideShorts: Boolean): String {
        if (!hideShorts) return ""
        return SHORTS_SELECTORS.joinToString(" ") { "$it { display: none !important; }" }
    }

    fun youTubeTweaksCall(css: String, options: YouTubeTweaksOptions, script: String): String? {
        if (css.isEmpty() && !options.frameThumbnails && !options.noHoverPreview) return null
        val config = JSONObject().apply {
            put("css", css)
            put("frameThumbnails", options.frameThumbnails)
            put("noHoverPreview", options.noHoverPreview)
        }
        return "($script)($config);"
    }

    val SHORTS_SELECTORS: List<String> = listOf(
        "ytd-rich-section-renderer:has(ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2)",
        "grid-shelf-view-model:has(ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2)",
        "ytd-reel-shelf-renderer",
        "ytd-rich-item-renderer:has(a[href^=\"/shorts/\"])",
        "ytd-video-renderer:has(a[href^=\"/shorts/\"])",
        "yt-lockup-view-model:has(a[href^=\"/shorts/\"])",
        "ytd-guide-entry-renderer:has(a[href^=\"/shorts\"])",
        "ytd-mini-guide-entry-renderer:has(a[href^=\"/shorts\"])",
        "yt-tab-shape[tab-title=\"Shorts\"]",
    )
}

class SponsorBlockClient(
    private val http: OkHttpClient = defaultClient(),
    private val nowMillis: () -> Long = { System.currentTimeMillis() },
) {
    private val cache = HashMap<String, Cached>()
    private val lock = Any()

    private data class Cached(val segments: List<SponsorBlockSegment>, val fetchedAt: Long)

    fun fetchSegments(videoId: String, options: SponsorBlockOptions, onResult: (List<SponsorBlockSegment>) -> Unit) {
        val categories = options.activeCategories
        if (!options.enabled || categories.isEmpty()) {
            onResult(emptyList())
            return
        }
        synchronized(lock) {
            cache[videoId]?.takeIf { nowMillis() - it.fetchedAt < CACHE_TTL_MILLIS }?.let { onResult(it.segments); return }
        }
        val request = Request.Builder().url(SponsorBlock.segmentsUrl(videoId, categories)).get().build()
        http.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, error: IOException) {
                onResult(emptyList())
            }

            override fun onResponse(call: Call, response: Response) {
                val segments = response.use {
                    if (!it.isSuccessful) return@use emptyList<SponsorBlockSegment>()
                    val body = it.body?.string().orEmpty()
                    if (body.isEmpty()) emptyList() else SponsorBlock.parseHashResponse(body, videoId, categories)
                }
                synchronized(lock) { cache[videoId] = Cached(segments, nowMillis()) }
                onResult(segments)
            }
        })
    }

    companion object {
        const val CACHE_TTL_MILLIS = 10L * 60 * 1000

        fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
            .build()
    }
}
