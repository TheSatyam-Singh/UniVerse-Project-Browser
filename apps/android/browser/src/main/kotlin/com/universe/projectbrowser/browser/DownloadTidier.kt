package com.universe.projectbrowser

object DownloadTidier {
    const val MAX_LENGTH = 60

    enum class Origin { NETWORK, CAPTURE }

    fun shouldTidy(isAutomaticFolder: Boolean, isPrivate: Boolean, origin: Origin): Boolean =
        isAutomaticFolder && !isPrivate && origin == Origin.NETWORK

    fun isMessy(filename: String): Boolean {
        val extension = fileExtension(filename)
        val stem = if (extension.isEmpty()) filename else filename.dropLast(extension.length + 1)
        val lower = stem.lowercase().trim()
        val generic = setOf("download", "file", "image", "img", "document", "doc", "untitled", "unnamed", "export", "attachment", "media", "video", "photo", "scan", "output")
        if (lower in generic) return true
        val patterns = listOf(
            Regex("[0-9a-f]{8,}"),
            Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}"),
            Regex("\\d{6,}"),
            Regex("\\s?\\(\\d+\\)$"),
            Regex("^(img|dsc|pxl|screenshot|image|file|download)[_\\-\\s]?\\d+", RegexOption.IGNORE_CASE),
        )
        return patterns.any { it.containsMatchIn(lower) }
    }

    fun acceptedName(proposal: String, replacing: String): String? {
        var stem = proposal.lineSequence().firstOrNull().orEmpty()
            .trim().trim('"', '\'', '`')
        stem = stem.map { if (it == '/' || it == ':' || it == '\\' || it == '\u0000') ' ' else it }.joinToString("")
            .replace(Regex("\\s+"), " ")
            .trim()
        if (stem.isEmpty() || stem.startsWith(".")) return null
        val extension = fileExtension(replacing)
        if (extension.isNotEmpty() && stem.lowercase().endsWith("." + extension.lowercase())) {
            stem = stem.dropLast(extension.length + 1)
        }
        if (extension.isEmpty()) stem = stem.replace(Regex("\\.\\w{1,5}$"), "")
        stem = stem.trim().trim('.', ' ')
        if (stem.length > MAX_LENGTH) stem = stem.take(MAX_LENGTH).trim()
        if (stem.none { it.isLetter() } || stem.startsWith(".")) return null
        val name = if (extension.isEmpty()) stem else "$stem.$extension"
        return if (name.equals(replacing, ignoreCase = true)) null else name
    }

    fun proposedName(filename: String, pageTitle: String?, domain: String?): String? {
        val title = pageTitle?.trim().orEmpty()
        if (title.isEmpty()) return null
        val words = title.split(Regex("[^\\p{L}\\p{N}]+")).filter { it.isNotEmpty() }
        if (words.isEmpty()) return null
        val proposal = words.take(6).joinToString(" ")
        return acceptedName(proposal, filename)
    }

    fun tidyName(filename: String, pageTitle: String?, domain: String?): String? {
        if (!isMessy(filename)) return null
        return proposedName(filename, pageTitle, domain)
    }

    fun fileExtension(filename: String): String {
        val dot = filename.lastIndexOf('.')
        if (dot <= 0) return ""
        val last = filename.substring(dot + 1)
        if (last.isEmpty()) return ""
        val stem = filename.substring(0, dot)
        val inner = stem.substringAfterLast('.', "")
        return if (inner.lowercase() == "tar") "$inner.$last" else last
    }
}
