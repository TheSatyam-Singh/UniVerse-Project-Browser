package com.universe.projectbrowser.appmodel

import com.universe.projectbrowser.store.AppPreferences
import com.universe.projectbrowser.store.MemoryKeyValueStore
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TabDeckSelectionTest {
    private fun deck() = TabDeckModel(AppPreferences(MemoryKeyValueStore()))

    @Test
    fun selectionStartsEmptyAndToggles() {
        val deck = deck()
        assertFalse(deck.isSelecting)
        assertTrue(deck.selectedIds.isEmpty())
        deck.toggleSelection("a")
        assertTrue(deck.isSelecting)
        assertEquals(setOf("a"), deck.selectedIds)
        deck.toggleSelection("b")
        assertEquals(setOf("a", "b"), deck.selectedIds)
        deck.toggleSelection("a")
        assertEquals(setOf("b"), deck.selectedIds)
        deck.toggleSelection("b")
        assertFalse(deck.isSelecting)
    }

    @Test
    fun beginningASelectionReplacesTheOldOne() {
        val deck = deck()
        deck.toggleSelection("a")
        deck.toggleSelection("b")
        deck.beginSelection("c")
        assertEquals(setOf("c"), deck.selectedIds)
    }

    @Test
    fun clearingAndForgettingDropSelectedTabs() {
        val deck = deck()
        deck.toggleSelection("a")
        deck.toggleSelection("b")
        deck.clearSelection()
        assertTrue(deck.selectedIds.isEmpty())
        deck.toggleSelection("a")
        deck.toggleSelection("b")
        deck.forget(setOf("a"))
        assertEquals(setOf("b"), deck.selectedIds)
    }
}
