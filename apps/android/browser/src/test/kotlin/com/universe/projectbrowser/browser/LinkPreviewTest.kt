package com.universe.projectbrowser

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LinkPreviewTest {
    @Test
    fun theGateRefusesPrivateBlockedLocalAndNonWebLinks() {
        assertTrue(LinkPreviewGate.mayFetch("https://example.com/a", isPrivate = false, blocked = false))
        assertFalse(LinkPreviewGate.mayFetch("https://example.com/a", isPrivate = true, blocked = false))
        assertFalse(LinkPreviewGate.mayFetch("https://example.com/a", isPrivate = false, blocked = true))
        assertFalse(LinkPreviewGate.mayFetch("http://localhost/x", isPrivate = false, blocked = false))
        assertFalse(LinkPreviewGate.mayFetch("http://192.168.1.1/", isPrivate = false, blocked = false))
        assertFalse(LinkPreviewGate.mayFetch("http://10.0.0.5/", isPrivate = false, blocked = false))
        assertFalse(LinkPreviewGate.mayFetch("http://172.16.4.2/", isPrivate = false, blocked = false))
        assertFalse(LinkPreviewGate.mayFetch("ftp://example.com/a", isPrivate = false, blocked = false))
        assertTrue(LinkPreviewGate.mayFetch("http://8.8.8.8/", isPrivate = false, blocked = false))
        assertTrue(LinkPreviewGate.mayFetch("https://192.168.0.1.evil.example/", isPrivate = false, blocked = false))
    }

    @Test
    fun reservedAddressesCoverLoopbackPrivateAndLinkLocalRanges() {
        assertTrue(LinkPreviewGate.isReservedAddress("127.0.0.1"))
        assertTrue(LinkPreviewGate.isReservedAddress("10.1.2.3"))
        assertTrue(LinkPreviewGate.isReservedAddress("192.168.0.1"))
        assertTrue(LinkPreviewGate.isReservedAddress("172.31.255.255"))
        assertTrue(LinkPreviewGate.isReservedAddress("169.254.1.2"))
        assertTrue(LinkPreviewGate.isReservedAddress("::1"))
        assertFalse(LinkPreviewGate.isReservedAddress("8.8.8.8"))
        assertFalse(LinkPreviewGate.isReservedAddress("93.184.216.34"))
        assertFalse(LinkPreviewGate.isReservedAddress("2001:db8::1"))
        assertFalse(LinkPreviewGate.isReservedAddress("example.com"))
    }

    @Test
    fun extractionReadsOpenGraphAndSkipsShortParagraphs() {
        val html = """
            <html><head>
            <title>Fallback Title</title>
            <meta property="og:title" content="Open Graph Title" />
            <meta property="og:description" content="A &amp; B description" />
            <meta property="og:image" content="/img.png" />
            <meta property="og:site_name" content="Example" />
            </head><body>
            <script>var x = 1;</script>
            <p>Short.</p>
            <p>This paragraph is long enough to be the lead text of the preview card shown to the reader.</p>
            <p>Another paragraph long enough to join the preview text when the first one is not enough.</p>
            </body></html>
        """.trimIndent()
        val page = LinkPreviewExtract.page(html, "https://example.com/a")
        assertEquals("Open Graph Title", page.title)
        assertEquals("A & B description", page.description)
        assertEquals("https://example.com/img.png", page.imageUrl)
        assertEquals("Example", page.siteName)
        assertEquals("https://example.com/a", page.landedUrl)
        assertTrue(page.text.startsWith("This paragraph is long enough"))
        assertFalse("Short." in page.text)
        assertFalse("var x" in page.text)
    }

    @Test
    fun extractionFallsBackToTheTitleTag() {
        val html = "<html><head><title>Plain &lt;Title&gt;</title></head><body><p></p></body></html>"
        val page = LinkPreviewExtract.page(html, "https://example.com/")
        assertEquals("Plain <Title>", page.title)
        assertNull(page.description)
        assertEquals("", page.text)
    }

    @Test
    fun cleaningStripsTagsAndDecodesEntities() {
        assertEquals("a & b — c", LinkPreviewExtract.clean("<b>a</b> &amp; b &mdash; c"))
    }
}
