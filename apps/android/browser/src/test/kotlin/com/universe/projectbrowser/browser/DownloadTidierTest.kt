package com.universe.projectbrowser

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DownloadTidierTest {
    @Test
    fun onlyAutomaticNonPrivateNetworkDownloadsAreTidied() {
        assertTrue(DownloadTidier.shouldTidy(true, false, DownloadTidier.Origin.NETWORK))
        assertFalse(DownloadTidier.shouldTidy(false, false, DownloadTidier.Origin.NETWORK))
        assertFalse(DownloadTidier.shouldTidy(true, true, DownloadTidier.Origin.NETWORK))
        assertFalse(DownloadTidier.shouldTidy(true, false, DownloadTidier.Origin.CAPTURE))
    }

    @Test
    fun hashesIdsAndGenericNamesAreMessyButReadableNamesAreNot() {
        assertTrue(DownloadTidier.isMessy("a1b2c3d4e5f6.pdf"))
        assertTrue(DownloadTidier.isMessy("550e8400-e29b-41d4-a716-446655440000.mp4"))
        assertTrue(DownloadTidier.isMessy("download.pdf"))
        assertTrue(DownloadTidier.isMessy("IMG_20260101.jpg"))
        assertTrue(DownloadTidier.isMessy("photo (1).jpg"))
        assertTrue(DownloadTidier.isMessy("file123456.mp4"))
        assertFalse(DownloadTidier.isMessy("Quarterly Report.pdf"))
        assertFalse(DownloadTidier.isMessy("Acme invoice October.pdf"))
    }

    @Test
    fun acceptedNamesKeepTheExtensionAndRefuseEmptyOrHiddenNames() {
        assertEquals("Navan itinerary.pdf", DownloadTidier.acceptedName("Navan itinerary", "a1b2c3.pdf"))
        assertEquals("Acme invoice October.pdf", DownloadTidier.acceptedName("Acme invoice October.pdf", "a1b2c3.pdf"))
        assertNull(DownloadTidier.acceptedName("", "x.pdf"))
        assertNull(DownloadTidier.acceptedName(".hidden", "x.pdf"))
        assertEquals("a b.pdf", DownloadTidier.acceptedName("a/b", "x.pdf"))
        assertNull(DownloadTidier.acceptedName("Quarterly Report", "Quarterly Report.pdf"))
        val long = DownloadTidier.acceptedName("A very long name that keeps going past the limit set for file names and more words here", "x.pdf")
        assertTrue(long != null && long.endsWith(".pdf"))
        assertTrue(long!!.dropLast(".pdf".length).length <= DownloadTidier.MAX_LENGTH)
    }

    @Test
    fun tidyNamesComeFromThePageTitle() {
        assertEquals("Acme invoice October.pdf", DownloadTidier.tidyName("a1b2c3d4.pdf", "Acme invoice October", "acme.example"))
        assertNull(DownloadTidier.tidyName("Quarterly Report.pdf", "Acme invoice October", "acme.example"))
        assertNull(DownloadTidier.tidyName("a1b2c3d4.pdf", null, "acme.example"))
        assertNull(DownloadTidier.tidyName("a1b2c3d4.pdf", "", "acme.example"))
    }

    @Test
    fun extensionsUnderstandTarballSuffixes() {
        assertEquals("tar.gz", DownloadTidier.fileExtension("backup.tar.gz"))
        assertEquals("gz", DownloadTidier.fileExtension("a.gz"))
        assertEquals("pdf", DownloadTidier.fileExtension("report.pdf"))
        assertEquals("", DownloadTidier.fileExtension("noext"))
        assertEquals("", DownloadTidier.fileExtension(".hidden"))
    }
}
