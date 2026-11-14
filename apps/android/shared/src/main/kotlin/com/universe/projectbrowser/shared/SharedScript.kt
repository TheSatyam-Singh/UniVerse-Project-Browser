package com.universe.projectbrowser.shared

enum class SharedScript(val fileName: String, val global: String) {
    SYNC("universe-sync", "ArdiaSync"),
    CORE("universe-core", "ArdiaCore");

    val assetName: String get() = "$fileName.hbc"
}
