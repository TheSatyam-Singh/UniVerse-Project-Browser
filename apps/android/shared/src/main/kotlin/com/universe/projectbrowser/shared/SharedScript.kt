package com.universe.projectbrowser.shared

enum class SharedScript(val fileName: String, val global: String) {
    SYNC("universe-sync", "UniVerseSync"),
    CORE("universe-core", "UniVerseCore");

    val assetName: String get() = "$fileName.hbc"
}
