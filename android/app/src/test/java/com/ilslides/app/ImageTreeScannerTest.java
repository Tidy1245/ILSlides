package com.ilslides.app;

import org.junit.Test;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import static org.junit.Assert.*;

public class ImageTreeScannerTest {
    private ImageTreeScanner.Document dir(String id) {
        return new ImageTreeScanner.Document(id,id,ImageTreeScanner.DIRECTORY,0);
    }
    private ImageTreeScanner.Document image(String id, String name, String mime) {
        return new ImageTreeScanner.Document(id,name,mime,1234);
    }

    @Test public void includesRootAndNestedImagesAndPreservesMetadata() throws Exception {
        Map<String,List<ImageTreeScanner.Document>> tree=new HashMap<>();
        tree.put("root",Arrays.asList(image("a","root.jpg","image/jpeg"),dir("child")));
        tree.put("child",Arrays.asList(dir("deep"),image("b","child.png","image/png")));
        tree.put("deep",Collections.singletonList(image("c","deep.webp","image/webp")));
        List<ImageTreeScanner.Document> result=ImageTreeScanner.scan("root","相簿",tree::get);
        assertEquals(3,result.size()); assertEquals("a",result.get(0).id);
        assertEquals("b",result.get(1).id); assertEquals("c",result.get(2).id);
        assertEquals("deep.webp",result.get(2).name); assertEquals(1234,result.get(2).modifiedAt);
        assertEquals("相簿",result.get(0).folderName); assertEquals("",result.get(0).folderPath);
        assertEquals("child",result.get(1).folderName); assertEquals("child",result.get(1).folderPath);
        assertEquals("deep",result.get(2).folderName); assertEquals("child/deep",result.get(2).folderPath);
    }

    @Test public void deduplicatesDocumentsAndDoesNotFollowCycles() throws Exception {
        Map<String,List<ImageTreeScanner.Document>> tree=new HashMap<>();
        tree.put("root",Arrays.asList(dir("child"),dir("child"),image("a","a.jpg",null)));
        tree.put("child",Arrays.asList(dir("root"),image("a","a.jpg",null),image("b","b.jpg",null)));
        List<ImageTreeScanner.Document> result=ImageTreeScanner.scan("root","相簿",tree::get);
        assertEquals(2,result.size()); assertEquals("a",result.get(0).id); assertEquals("b",result.get(1).id);
    }

    @Test public void filtersNonImagesAndAcceptsExtensionFallback() throws Exception {
        List<ImageTreeScanner.Document> result=ImageTreeScanner.scan("root","相簿",id -> Arrays.asList(
            image("a","PHOTO.HEIC","application/octet-stream"),image("b",null,"image/png"),
            image("c","notes.txt","text/plain"),image("d",null,null),image(null,"invalid.jpg","image/jpeg")));
        assertEquals(2,result.size()); assertEquals("a",result.get(0).id); assertNull(result.get(1).name);
    }

    @Test public void emptyTreeReturnsEmptyList() throws Exception {
        assertTrue(ImageTreeScanner.scan("root","相簿",id -> Collections.emptyList()).isEmpty());
    }

    @Test(expected=SecurityException.class) public void deniedSubdirectoryReportsFailureInsteadOfPartialResults() throws Exception {
        ImageTreeScanner.scan("root","相簿",id -> {
            if (id.equals("root")) return Arrays.asList(image("a","a.jpg",null),dir("denied"));
            throw new SecurityException("Permission revoked");
        });
    }

    @Test public void veryDeepTreeDoesNotOverflowTheStack() throws Exception {
        List<ImageTreeScanner.Document> result=ImageTreeScanner.scan("0","相簿",id -> {
            int depth=Integer.parseInt(id);
            return depth<10000 ? Collections.singletonList(dir(String.valueOf(depth+1))) :
                Collections.singletonList(image("photo","photo.jpg","image/jpeg"));
        });
        assertEquals(1,result.size());
    }
}
