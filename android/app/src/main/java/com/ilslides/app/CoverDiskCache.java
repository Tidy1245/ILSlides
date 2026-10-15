package com.ilslides.app;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;

/** Rebuildable cover files only. All operations run on the plugin's cache worker. */
final class CoverDiskCache {
    private final File directory;
    private final long limit;
    static final class Entry {
        final File file;
        final String sourceUri, signature;
        final long createdAt;
        Entry(File file, String sourceUri, String signature, long createdAt) {
            this.file=file; this.sourceUri=sourceUri; this.signature=signature; this.createdAt=createdAt;
        }
    }
    CoverDiskCache(File directory, long limit) throws IOException {
        this.directory=directory; this.limit=limit;
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Cannot create cover cache");
    }
    private String hash(String key) throws Exception {
        byte[] digest=MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8));
        StringBuilder result=new StringBuilder();
        for (byte b:digest) result.append(String.format(Locale.ROOT,"%02x",b & 255));
        return result.toString();
    }
    private Properties properties(File file) throws IOException {
        Properties p=new Properties();
        try (InputStream input=new FileInputStream(file)) { p.load(input); }
        return p;
    }
    Entry get(String key) throws Exception {
        File meta=new File(directory,hash(key)+".properties");
        if (!meta.isFile()) return null;
        try {
            Properties p=properties(meta);
            String name=p.getProperty("file","");
            if (!name.matches("[a-f0-9]{64}\\.[a-f0-9-]+\\.webp")) throw new IOException("Invalid cache filename");
            File file=new File(directory,name);
            if (!file.isFile() || file.length()==0) { remove(key); return null; }
            long now=System.currentTimeMillis(); meta.setLastModified(now); file.setLastModified(now);
            return new Entry(file,p.getProperty("sourceUri",""),p.getProperty("signature",""),Long.parseLong(p.getProperty("createdAt")));
        } catch (IOException | IllegalArgumentException e) { meta.delete(); return null; }
    }
    Entry put(String key, byte[] bytes, String sourceUri, String signature) throws Exception {
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Cannot recreate cover cache");
        String prefix=hash(key);
        File meta=new File(directory,prefix+".properties");
        Entry previous=get(key);
        File file=new File(directory,prefix+"."+UUID.randomUUID()+".webp");
        File temp=File.createTempFile("cover-",".tmp",directory);
        File metaTemp=File.createTempFile("index-",".tmp",directory);
        long now=System.currentTimeMillis();
        boolean committed=false;
        try {
            try (OutputStream output=new FileOutputStream(temp)) { output.write(bytes); }
            Files.move(temp.toPath(),file.toPath(),StandardCopyOption.REPLACE_EXISTING);
            Properties p=new Properties();
            p.setProperty("file",file.getName()); p.setProperty("sourceUri",sourceUri);
            p.setProperty("signature",signature); p.setProperty("createdAt",Long.toString(now));
            try (OutputStream output=new FileOutputStream(metaTemp)) { p.store(output,null); }
            try { Files.move(metaTemp.toPath(),meta.toPath(),StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE); }
            catch (AtomicMoveNotSupportedException e) { Files.move(metaTemp.toPath(),meta.toPath(),StandardCopyOption.REPLACE_EXISTING); }
            committed=true;
            if (previous!=null) previous.file.delete();
            prune();
            return file.isFile() ? new Entry(file,sourceUri,signature,now) : null;
        } finally { temp.delete(); metaTemp.delete(); if (!committed) file.delete(); }
    }
    void remove(String key) throws Exception {
        String prefix=hash(key);
        File[] files=directory.listFiles((dir,name)->name.startsWith(prefix+"."));
        if (files!=null) for (File file:files) file.delete();
    }
    void clear() {
        File[] files=directory.listFiles();
        if (files!=null) for (File file:files) file.delete();
    }
    private void prune() throws IOException {
        File[] files=directory.listFiles();
        if (files==null) return;
        Set<String> referenced=new HashSet<>();
        List<File> indexes=new ArrayList<>();
        for (File file:files) if (file.getName().endsWith(".properties")) {
            try { referenced.add(properties(file).getProperty("file","")); indexes.add(file); }
            catch (IOException | IllegalArgumentException e) { file.delete(); }
        }
        long size=0;
        for (File file:files) {
            if (file.getName().endsWith(".tmp") || (file.getName().endsWith(".webp") && !referenced.contains(file.getName()))) file.delete();
            else if (file.isFile()) size+=file.length();
        }
        indexes.sort(Comparator.comparingLong(File::lastModified));
        for (File meta:indexes) {
            if (size<=limit) break;
            File image=new File(directory,properties(meta).getProperty("file"));
            size-=image.length()+meta.length(); image.delete(); meta.delete();
        }
    }
}
