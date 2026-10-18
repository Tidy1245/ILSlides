package com.ilslides.app;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Walk document IDs within a single SAF tree without growing the call stack. */
final class ImageTreeScanner {
    static final String DIRECTORY = "vnd.android.document/directory";

    static final class Document {
        final String id, name, mime;
        final long modifiedAt;

        Document(String id, String name, String mime, long modifiedAt) {
            this.id=id; this.name=name; this.mime=mime; this.modifiedAt=modifiedAt;
        }

        boolean isImage() {
            return (mime!=null && mime.startsWith("image/")) ||
                (name!=null && name.toLowerCase(Locale.ROOT).matches(".*\\.(jpg|jpeg|png|webp|gif|heic|heif|bmp|avif)$"));
        }
    }

    interface Reader { List<Document> children(String parentId) throws Exception; }

    static List<Document> scan(String rootId, Reader reader) throws Exception {
        ArrayDeque<String> pending=new ArrayDeque<>();
        Set<String> visited=new HashSet<>();
        List<Document> images=new ArrayList<>();
        pending.add(rootId); visited.add(rootId);
        while (!pending.isEmpty()) {
            for (Document document:reader.children(pending.removeFirst())) {
                if (document.id==null || !visited.add(document.id)) continue;
                if (DIRECTORY.equals(document.mime)) pending.addLast(document.id);
                else if (document.isImage()) images.add(document);
            }
        }
        return images;
    }
}
