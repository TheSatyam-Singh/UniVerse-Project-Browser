package com.universe.projectbrowser

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SponsorBlockTest {
    @Test
    fun videoIdsAreReadFromWatchEmbedShortsAndShortLinks() {
        assertEquals("dQw4w9WgXcQ", SponsorBlock.videoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10"))
        assertEquals("dQw4w9WgXcQ", SponsorBlock.videoId("https://www.youtube.com/embed/dQw4w9WgXcQ"))
        assertEquals("dQw4w9WgXcQ", SponsorBlock.videoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"))
        assertEquals("dQw4w9WgXcQ", SponsorBlock.videoId("https://youtu.be/dQw4w9WgXcQ"))
        assertNull(SponsorBlock.videoId("https://www.youtube.com/"))
        assertNull(SponsorBlock.videoId(null))
    }

    @Test
    fun onlyYouTubeHostsCount() {
        assertTrue(SponsorBlock.isYouTubeHost("www.youtube.com"))
        assertTrue(SponsorBlock.isYouTubeHost("m.youtube.com"))
        assertTrue(SponsorBlock.isYouTubeHost("youtu.be"))
        assertFalse(SponsorBlock.isYouTubeHost("www.google.com"))
        assertFalse(SponsorBlock.isYouTubeHost(null))
    }

    @Test
    fun hashPrefixMatchesSha256() {
        assertEquals("5f6b", SponsorBlock.sha256HexPrefix("dQw4w9WgXcQ"))
        assertEquals("28cb", SponsorBlock.sha256HexPrefix("aaaaaaaaaaa"))
    }

    @Test
    fun parsingKeepsOnlyEnabledSkipAndMuteSegmentsInRange() {
        val body = """[{"videoID":"dQw4w9WgXcQ","segments":[
            {"UUID":"a","segment":[10,20],"category":"sponsor","actionType":"skip"},
            {"UUID":"b","segment":[30,40],"category":"intro","actionType":"skip"},
            {"UUID":"c","segment":[50,90000],"category":"sponsor","actionType":"skip"},
            {"UUID":"d","segment":[60,70],"category":"sponsor","actionType":"mute"},
            {"segment":[80,90],"category":"sponsor","actionType":"skip"},
            {"UUID":"e","segment":[95,90],"category":"sponsor","actionType":"skip"},
            {"UUID":"f","segment":[100,110],"category":"preview","actionType":"skip"}
        ]}]"""
        val segments = SponsorBlock.parseHashResponse(body, "dQw4w9WgXcQ", setOf("sponsor", "intro"))
        assertEquals(listOf("a", "b", "d"), segments.map { it.uuid })
        assertEquals(listOf(10.0, 30.0, 60.0), segments.map { it.segment[0] })
        assertEquals(emptyList<SponsorBlockSegment>(), SponsorBlock.parseHashResponse(body, "otherVideoId", setOf("sponsor")))
        assertEquals(emptyList<SponsorBlockSegment>(), SponsorBlock.parseHashResponse("not json", "dQw4w9WgXcQ", setOf("sponsor")))
    }

    @Test
    fun defaultsSkipSponsorsAutomaticallyAndHighlightsManually() {
        val options = SponsorBlockOptions(true)
        assertEquals("auto", options.effectiveCategories["sponsor"])
        assertEquals("manual", options.effectiveCategories["poi_highlight"])
        assertEquals("disabled", options.effectiveCategories["intro"])
        assertTrue("sponsor" in options.activeCategories)
        assertTrue("poi_highlight" in options.activeCategories)
        assertFalse("intro" in options.activeCategories)
        assertTrue(SponsorBlockOptions.DISABLED.activeCategories.isEmpty())
    }

    @Test
    fun deliveryCallsTheContentScriptReceiver() {
        val segments = listOf(SponsorBlockSegment("a", "sponsor", listOf(10.0, 20.0), "skip"))
        val script = SponsorBlock.deliveryScript(segments, SponsorBlockOptions(true))
        assertTrue(script.startsWith("window.__nookSponsorBlock?.receiveSegments("))
        assertTrue("\"UUID\":\"a\"" in script.replace(" ", ""))
    }

    @Test
    fun youTubeTweaksNeedSomethingToHideOrChange() {
        assertNull(SponsorBlock.youTubeTweaksCall("", YouTubeTweaksOptions.DISABLED, "(function(c){})"))
        val call = SponsorBlock.youTubeTweaksCall("x { display: none !important; }", YouTubeTweaksOptions(frameThumbnails = true), "(function(c){})")
        assertTrue(call!!.contains("\"frameThumbnails\":true"))
        assertTrue(SponsorBlock.youTubeTweaksCss(true).contains("ytd-reel-shelf-renderer"))
        assertEquals("", SponsorBlock.youTubeTweaksCss(false))
    }
}
