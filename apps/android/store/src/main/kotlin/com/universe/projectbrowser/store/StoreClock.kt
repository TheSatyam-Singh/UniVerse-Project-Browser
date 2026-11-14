package com.universe.projectbrowser.store

fun interface StoreClock {
    fun now(): Long

    companion object {
        val system: StoreClock = StoreClock { System.currentTimeMillis() }
    }
}
