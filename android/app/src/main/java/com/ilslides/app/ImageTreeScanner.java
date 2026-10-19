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
        final String id, name, mime, folderName, folderPath;
        final long modifiedAt;

        Document(String id, String name, String mime, long modifiedAt) {
            this(id,name,mime,modifiedAt,"","");
        }

        Document(String id, String name, String mime, long modifiedAt, String folderName, String folderPath) {
            this.id=id; this.name=name; this.mime=mime; this.modifiedAt=modifiedAt;
            this.folderName=folderName; this.folderPath=folderPath;
        }

        boolean isImage() {
            return (mime!=null && mime.startsWith("image/")) ||
                (name!=null && name.toLowerCase(Locale.ROOT).matches(".*\\.(jpg|jpeg|png|webp|gif|heic|heif|bmp|avif)$"));
        }
    }

    interface Reader { List<Document> children(String parentId) throws Exception; }

    private static final class Folder {
        final String id, name, path;
        Folder(String id, String name, String path) {this.id=id; this.name=name; this.path=path;}
    }

    static List<Document> scan(String rootId, String rootName, Reader reader) throws Exception {
        ArrayDeque<Folder> pending=new ArrayDeque<>();
        Set<String> visited=new HashSet<>();
        List<Document> images=new ArrayList<>();
        pending.add(new Folder(rootId,rootName==null ? "" : rootName,"")); visited.add(rootId);
        while (!pending.isEmpty()) {
            Folder folder=pending.removeFirst();
            for (Document document:reader.children(folder.id)) {
                if (document.id==null || !visited.add(document.id)) continue;
                if (DIRECTORY.equals(document.mime)) {
                    String name=document.name==null || document.name.isEmpty() ? folder.name : document.name;
                    String path=document.name==null || document.name.isEmpty() ? folder.path :
                        folder.path.isEmpty() ? document.name : folder.path+"/"+document.name;
                    pending.addLast(new Folder(document.id,name,path));
                } else if (document.isImage()) images.add(new Document(document.id,document.name,document.mime,document.modifiedAt,folder.name,folder.path));
            }
        }
        return images;
    }
}
