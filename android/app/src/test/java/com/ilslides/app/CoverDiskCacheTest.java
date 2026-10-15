package com.ilslides.app;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import java.io.File;
import java.nio.file.Files;
import static org.junit.Assert.*;

public class CoverDiskCacheTest {
    @Rule public TemporaryFolder temporary=new TemporaryFolder();
    @Test public void persistsAcrossInstancesAndMissingFilesAreMisses() throws Exception {
        File folder=temporary.newFolder();
        CoverDiskCache cache=new CoverDiskCache(folder,65536);
        CoverDiskCache.Entry value=cache.put("key",new byte[]{1,2,3},"content://image","10:3");
        CoverDiskCache.Entry loaded=new CoverDiskCache(folder,65536).get("key");
        assertEquals("content://image",loaded.sourceUri);assertEquals("10:3",loaded.signature);
        assertArrayEquals(new byte[]{1,2,3},Files.readAllBytes(loaded.file.toPath()));
        value.file.delete();assertNull(cache.get("key"));
    }
    @Test public void replacementUsesNewUrlAndRemovesPreviousFile() throws Exception {
        CoverDiskCache cache=new CoverDiskCache(temporary.newFolder(),65536);
        CoverDiskCache.Entry old=cache.put("key",new byte[]{1},"uri","1");
        CoverDiskCache.Entry next=cache.put("key",new byte[]{2},"uri","2");
        assertNotEquals(old.file,next.file);assertFalse(old.file.exists());assertEquals("2",cache.get("key").signature);
    }
    @Test public void evictsLeastRecentlyUsedAndStaysBounded() throws Exception {
        File folder=temporary.newFolder();CoverDiskCache cache=new CoverDiskCache(folder,1800);
        cache.put("a",new byte[500],"uri","1");cache.put("b",new byte[500],"uri","1");
        for(File file:folder.listFiles()) file.setLastModified(1);
        cache.get("a");cache.put("c",new byte[500],"uri","1");
        assertNotNull(cache.get("a"));assertNull(cache.get("b"));assertNotNull(cache.get("c"));
        long total=0;for(File file:folder.listFiles())total+=file.length();assertTrue(total<=1800);
    }
    @Test public void clearAndRemoveLeaveCollectionDataAlone() throws Exception {
        File folder=temporary.newFolder();CoverDiskCache cache=new CoverDiskCache(folder,65536);
        cache.put("a",new byte[]{1},"uri","1");cache.put("b",new byte[]{1},"uri","1");
        cache.remove("a");assertNull(cache.get("a"));assertNotNull(cache.get("b"));
        cache.clear();assertEquals(0,folder.listFiles().length);
    }
    @Test public void recreatesDirectoryRemovedBySystem() throws Exception {
        File folder=temporary.newFolder();CoverDiskCache cache=new CoverDiskCache(folder,65536);
        assertTrue(folder.delete());assertNotNull(cache.put("a",new byte[]{1},"uri","1"));
    }
}
