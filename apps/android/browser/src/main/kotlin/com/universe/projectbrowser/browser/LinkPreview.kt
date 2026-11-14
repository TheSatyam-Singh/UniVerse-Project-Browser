package com.universe.projectbrowser

import java.net.InetAddress
import java.net.URI
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

data class LinkPreviewPage(
    val title: String?,
    val description: String?,
    val imageUrl: String?,
    val iconUrl: String?,
    val siteName: String?,
    val landedUrl: String?,
    val text: String,
)

object LinkPreviewGate {
    private val reservedSuffixes = listOf(".localhost", ".local", ".lan", ".internal", ".home.arpa")

    fun mayFetch(url: String, isPrivate: Boolean, blocked: Boolean): Boolean {
        if (isPrivate || blocked) return false
        val uri = runCatching { URI(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase() ?: return false
        if (scheme != "http" && scheme != "https") return false
        var host = uri.host?.lowercase() ?: return false
        while (host.endsWith(".")) host = host.dropLast(1)
        if (host.isEmpty()) return false
        if (reservedSuffixes.any { host.endsWith(it) }) return false
        if (isReservedAddress(host)) return false
        return host.contains(".") || host.contains(":")
    }

    fun isReservedAddress(host: String): Boolean {
        val literal = parseIpLiteral(host) ?: return false
        return isReserved(literal)
    }

    fun resolvesToPublic(host: String): Boolean {
        val addresses = runCatching { InetAddress.getAllByName(host) }.getOrNull() ?: return false
        if (addresses.isEmpty()) return false
        return addresses.none { isReserved(it.address) }
    }

    private fun parseIpLiteral(host: String): ByteArray? {
        val trimmed = host.trim('[', ']')
        if (trimmed.contains(':')) {
            if (!trimmed.all { it.isDigit() || it in 'a'..'f' || it in 'A'..'F' || it == ':' || it == '.' }) return null
            return runCatching { InetAddress.getByName(trimmed) }.getOrNull()?.takeIf { it is java.net.Inet6Address }?.address
        }
        val parts = trimmed.split('.')
        if (parts.size != 4 || parts.any { it.isEmpty() || it.length > 3 || it.any { char -> !char.isDigit() } }) return null
        val bytes = parts.map { it.toInt() }
        if (bytes.any { it > 255 }) return null
        return bytes.map { it.toByte() }.toByteArray()
    }

    private fun isReserved(address: ByteArray): Boolean {
        if (address.size == 4) {
            val a = address.map { it.toInt() and 0xFF }
            val value = (a[0] shl 24) or (a[1] shl 16) or (a[2] shl 8) or a[3]
            val top = value ushr 24
            return top == 0 || top == 10 || top == 127 || top >= 224 ||
                (value ushr 20) == 0xAC1 ||
                (value ushr 16) == 0xC0A8 ||
                (value ushr 16) == 0xA9FE ||
                (value ushr 22) == 0x191 ||
                (value ushr 17) == 0x6309
        }
        if (address.size == 16) {
            val first = address[0].toInt() and 0xFF
            val second = address[1].toInt() and 0xFF
            if (first == 0xFE && second and 0xC0 == 0x80) return true
            if (first and 0xFE == 0xFC) return true
            if (first == 0xFF) return true
            if (address.take(12).all { it == 0.toByte() }) {
                val embedded = address.copyOfRange(12, 16)
                return isReserved(embedded)
            }
            if (address.take(10).all { it == 0.toByte() } && address[10] == 0xFF.toByte() && address[11] == 0xFF.toByte()) {
                return isReserved(address.copyOfRange(12, 16))
            }
            if (address[0] == 0x00.toByte() && address[1] == 0x64.toByte() && address[2] == 0xFF.toByte() && address[3] == 0x9B.toByte() &&
                address.copyOfRange(4, 12).all { it == 0.toByte() }
            ) {
                return isReserved(address.copyOfRange(12, 16))
            }
        }
        return false
    }
}

object LinkPreviewExtract {
    const val MAX_TEXT = 2500

    fun page(fromHtml: String, baseUrl: String): LinkPreviewPage {
        val base = runCatching { URI(baseUrl) }.getOrNull()
        val headEnd = Regex("</head>", RegexOption.IGNORE_CASE).find(fromHtml)?.range?.last
        val head = if (headEnd != null) fromHtml.substring(0, headEnd + 1) else fromHtml.take(60_000)
        val title = meta(head, "og:title") ?: firstMatch("<title[^>]*>([\\s\\S]*?)</title>", head)?.let(::clean)
        val description = meta(head, "og:description") ?: meta(head, "description")
        val image = (meta(head, "og:image") ?: meta(head, "twitter:image"))?.let { resolve(it, base) }?.takeIf { isWeb(it) }
        val icon = (firstMatch("<link\\b[^>]*\\brel\\s*=\\s*[\"'][^\"']*\\bicon\\b[^\"']*[\"'][^>]*\\bhref\\s*=\\s*[\"']([^\"']*)[\"']", head)
            ?: firstMatch("<link\\b[^>]*\\bhref\\s*=\\s*[\"']([^\"']*)[\"'][^>]*\\brel\\s*=\\s*[\"'][^\"']*\\bicon\\b", head))
            ?.let { resolve(clean(it), base) }?.takeIf { isWeb(it) }
        val body = fromHtml.replace(Regex("<(script|style|noscript|svg|nav|footer|header)\\b[\\s\\S]*?</\\1>", RegexOption.IGNORE_CASE), " ")
        var text = ""
        for (paragraph in allMatches("<p\\b[^>]*>([\\s\\S]*?)</p>", body)) {
            val line = clean(paragraph)
            if (line.length < 40) continue
            text += line + "\n"
            if (text.length >= MAX_TEXT) break
        }
        return LinkPreviewPage(
            title = title?.takeIf { it.isNotEmpty() },
            description = description?.takeIf { it.isNotEmpty() },
            imageUrl = image,
            iconUrl = icon,
            siteName = meta(head, "og:site_name")?.takeIf { it.isNotEmpty() },
            landedUrl = baseUrl,
            text = text.take(MAX_TEXT),
        )
    }

    private fun meta(head: String, key: String): String? {
        val escaped = Regex.escape(key)
        val patterns = listOf(
            "<meta[^>]+(?:property|name)\\s*=\\s*[\"']$escaped[\"'][^>]*content\\s*=\\s*[\"']([^\"']*)[\"']",
            "<meta[^>]+content\\s*=\\s*[\"']([^\"']*)[\"'][^>]*(?:property|name)\\s*=\\s*[\"']$escaped[\"']",
        )
        for (pattern in patterns) {
            firstMatch(pattern, head)?.let { return clean(it) }
        }
        return null
    }

    fun clean(fragment: String): String {
        var text = fragment.replace(Regex("<[^>]+>"), " ")
        for ((entity, character) in ENTITIES) text = text.replace(entity, character)
        return text.replace(Regex("\\s+"), " ").trim()
    }

    private val ENTITIES = listOf(
        "&amp;" to "&", "&quot;" to "\"", "&#39;" to "'", "&#x27;" to "'", "&apos;" to "'",
        "&lt;" to "<", "&gt;" to ">", "&nbsp;" to " ", "&mdash;" to "—", "&ndash;" to "–",
        "&rsquo;" to "’", "&lsquo;" to "‘", "&ldquo;" to "“", "&rdquo;" to "”", "&hellip;" to "…",
    )

    private fun resolve(url: String, base: URI?): String? {
        if (base == null) return url.takeIf { it.startsWith("http://") || it.startsWith("https://") }
        return runCatching { base.resolve(url).toString() }.getOrNull()
    }

    private fun isWeb(url: String): Boolean = url.startsWith("http://") || url.startsWith("https://")

    private fun firstMatch(pattern: String, text: String): String? = allMatches(pattern, text, limit = 1).firstOrNull()

    private fun allMatches(pattern: String, text: String, limit: Int = Int.MAX_VALUE): List<String> {
        val regex = runCatching { Regex(pattern, RegexOption.IGNORE_CASE) }.getOrNull() ?: return emptyList()
        val found = ArrayList<String>()
        for (match in regex.findAll(text)) {
            val groups = match.groupValues
            if (groups.size > 1) found += groups.last()
            if (found.size >= limit) break
        }
        return found
    }
}

class LinkPreviewFetcher(
    private val http: OkHttpClient = defaultClient(),
) {
    suspend fun fetch(url: String, isPrivate: Boolean = false, blocked: Boolean = false): LinkPreviewPage? = withContext(Dispatchers.IO) {
        if (!LinkPreviewGate.mayFetch(url, isPrivate, blocked)) return@withContext null
        var current = url
        var landed: String? = null
        repeat(MAX_REDIRECTS + 1) {
            val host = runCatching { URI(current).host }.getOrNull() ?: return@withContext null
            if (!LinkPreviewGate.resolvesToPublic(host)) return@withContext null
            val request = Request.Builder().url(current).header("Accept", "text/html").build()
            val response = runCatching { http.newCall(request).execute() }.getOrNull() ?: return@withContext null
            response.use {
                val location = it.header("Location")
                if (it.isRedirect && location != null) {
                    val next = runCatching { URI(current).resolve(location).toString() }.getOrNull() ?: return@withContext null
                    if (!LinkPreviewGate.mayFetch(next, isPrivate, blocked)) return@withContext null
                    current = next
                    return@repeat
                }
                if (!it.isSuccessful) return@withContext null
                val bytes = it.body?.byteStream()?.use { stream ->
                    val out = java.io.ByteArrayOutputStream()
                    val buffer = ByteArray(8192)
                    var remaining = MAX_BYTES
                    while (remaining > 0) {
                        val read = stream.read(buffer, 0, minOf(buffer.size.toLong(), remaining).toInt())
                        if (read == -1) break
                        out.write(buffer, 0, read)
                        remaining -= read
                    }
                    out.toByteArray()
                } ?: ByteArray(0)
                val body = bytes.toString(Charsets.UTF_8)
                if (body.isEmpty()) return@withContext null
                landed = current
                val page = LinkPreviewExtract.page(body, current)
                return@withContext page.copy(landedUrl = landed)
            }
        }
        null
    }

    companion object {
        const val MAX_BYTES = 512L * 1024
        const val MAX_REDIRECTS = 5

        fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
            .followRedirects(false)
            .followSslRedirects(false)
            .build()
    }
}
