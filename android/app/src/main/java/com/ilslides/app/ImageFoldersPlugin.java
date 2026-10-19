package com.ilslides.app;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageDecoder;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "ImageFolders")
public class ImageFoldersPlugin extends Plugin {
    private final ExecutorService cacheWorker=Executors.newSingleThreadExecutor();
    private final ExecutorService sourceWorker=Executors.newSingleThreadExecutor();
    private final ExecutorService imageWorker=Executors.newSingleThreadExecutor();
    private CoverDiskCache coverStore;

    @Override
    protected void handleOnDestroy() { cacheWorker.shutdownNow(); sourceWorker.shutdownNow(); imageWorker.shutdownNow(); }

    private CoverDiskCache store() throws Exception {
        if (coverStore==null) coverStore=new CoverDiskCache(new File(getContext().getCacheDir(),"covers"),64L*1024*1024);
        return coverStore;
    }

    private JSObject entry(CoverDiskCache.Entry value) {
        JSObject result=new JSObject();
        if (value!=null) {
            JSObject data=new JSObject();
            data.put("uri",Uri.fromFile(value.file).toString()); data.put("sourceUri",value.sourceUri);
            data.put("signature",value.signature); data.put("createdAt",value.createdAt); result.put("entry",data);
        }
        return result;
    }

    @PluginMethod
    public void coverCache(PluginCall call) {
        cacheWorker.execute(()->{
            try {
                String op=call.getString("op",""),key=call.getString("key","");
                CoverDiskCache cache=store();
                if ("clear".equals(op)) { cache.clear(); call.resolve(); return; }
                if (key.isEmpty()) throw new IllegalArgumentException("Missing cover key");
                if ("get".equals(op)) {
                    CoverDiskCache.Entry value=cache.get(key);
                    if (value!=null) {
                        BitmapFactory.Options bounds=new BitmapFactory.Options(); bounds.inJustDecodeBounds=true;
                        BitmapFactory.decodeFile(value.file.getAbsolutePath(),bounds);
                        if (bounds.outWidth<=0 || bounds.outHeight<=0) { cache.remove(key); value=null; }
                    }
                    call.resolve(entry(value));
                } else if ("put".equals(op)) {
                    String data=call.getString("data","");
                    if (!data.startsWith("data:image/webp;base64,")) throw new IllegalArgumentException("Invalid cover data");
                    byte[] bytes=Base64.decode(data.substring(data.indexOf(',')+1),Base64.DEFAULT);
                    call.resolve(entry(cache.put(key,bytes,call.getString("sourceUri",""),call.getString("signature",""))));
                } else if ("remove".equals(op)) { cache.remove(key); call.resolve(); }
                else throw new IllegalArgumentException("Unknown cache operation");
            } catch (Exception e) { call.reject("封面快取無法讀寫。",e); }
        });
    }

    @PluginMethod
    public void sourceState(PluginCall call) {
        sourceWorker.execute(()->{
            JSObject result=new JSObject(); result.put("signature","");
            try {
                Uri uri=Uri.parse(call.getString("uri",""));
                if (!"content".equals(uri.getScheme())) throw new IllegalArgumentException("Invalid source");
                String[] fields={DocumentsContract.Document.COLUMN_LAST_MODIFIED,DocumentsContract.Document.COLUMN_SIZE};
                try (Cursor cursor=getContext().getContentResolver().query(uri,fields,null,null,null)) {
                    if (cursor==null) result.put("status","unknown");
                    else if (!cursor.moveToFirst()) result.put("status","missing");
                    else {
                        result.put("status","ok");
                        long modified=cursor.isNull(0) ? 0 : cursor.getLong(0);
                        if (modified>0 && !cursor.isNull(1)) result.put("signature",modified+":"+cursor.getLong(1));
                    }
                }
            } catch (SecurityException e) { result.put("status","denied"); }
            catch (Exception e) { result.put("status","unknown"); }
            call.resolve(result);
        });
    }
    @PluginMethod
    public void pick(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, "folderPicked");
    }

    @ActivityCallback
    private void folderPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject value = new JSObject(); value.put("cancelled", true); call.resolve(value); return;
        }
        try {
            Uri tree = result.getData().getData();
            getContext().getContentResolver().takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Uri document = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
            String name = "圖片目錄";
            try (Cursor cursor = getContext().getContentResolver().query(document, new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) name = cursor.getString(0);
            }
            JSObject value = new JSObject(); value.put("uri", tree.toString()); value.put("name", name); call.resolve(value);
        } catch (Exception e) { call.reject("無法保存目錄授權，請重新選擇。", e); }
    }

    @PluginMethod
    public void list(PluginCall call) {
        String treeValue = call.getString("tree");
        if (treeValue == null) { call.reject("缺少目錄"); return; }
        execute(() -> {
            try {
                Uri tree = Uri.parse(treeValue);
                JSArray images = new JSArray();
                String rootId=DocumentsContract.getTreeDocumentId(tree);
                String rootName="";
                Uri rootDocument=DocumentsContract.buildDocumentUriUsingTree(tree,rootId);
                try (Cursor cursor=getContext().getContentResolver().query(rootDocument,new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME},null,null,null)) {
                    if (cursor!=null && cursor.moveToFirst() && !cursor.isNull(0)) rootName=cursor.getString(0);
                }
                for (ImageTreeScanner.Document document:ImageTreeScanner.scan(rootId,rootName, parentId -> {
                    Uri children=DocumentsContract.buildChildDocumentsUriUsingTree(tree,parentId);
                    java.util.List<ImageTreeScanner.Document> documents=new java.util.ArrayList<>();
                    String[] projection={DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_LAST_MODIFIED};
                    try (Cursor cursor=getContext().getContentResolver().query(children,projection,null,null,null)) {
                        if (cursor==null) throw new IllegalStateException("目錄無法讀取");
                        int modifiedIndex=cursor.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED);
                        while (cursor.moveToNext()) {
                            long modified=modifiedIndex>=0 && !cursor.isNull(modifiedIndex) ? cursor.getLong(modifiedIndex) : 0;
                            documents.add(new ImageTreeScanner.Document(cursor.getString(0),cursor.getString(1),cursor.getString(2),modified));
                        }
                    }
                    return documents;
                })) {
                    JSObject image=new JSObject();
                    image.put("uri",DocumentsContract.buildDocumentUriUsingTree(tree,document.id).toString());
                    image.put("name",document.name==null ? "未命名圖片" : document.name);
                    if (document.modifiedAt>0) image.put("modifiedAt",document.modifiedAt);
                    if (!document.folderName.isEmpty()) image.put("folderName",document.folderName);
                    if (!document.folderPath.isEmpty()) image.put("folderPath",document.folderPath);
                    images.put(image);
                }
                JSObject value = new JSObject(); value.put("images", images); call.resolve(value);
            } catch (Exception e) { call.reject("目錄授權已失效或目錄已移動，請重新選擇。", e); }
        });
    }

    @PluginMethod
    public void image(PluginCall call) {
        String uriValue = call.getString("uri");
        if (uriValue == null) { call.reject("缺少圖片 URI"); return; }
        int maxSize = Math.max(128, Math.min(2560, call.getInt("size", 2048)));
        imageWorker.execute(() -> {
            Bitmap bitmap = null;
            try {
                Uri uri = Uri.parse(uriValue);
                if (!"content".equals(uri.getScheme())) throw new IllegalArgumentException("僅支援授權圖片");
                // ImageDecoder applies EXIF orientation and downsamples before allocating pixels.
                bitmap = ImageDecoder.decodeBitmap(ImageDecoder.createSource(getContext().getContentResolver(), uri), (decoder, info, source) -> {
                    int w = info.getSize().getWidth(), h = info.getSize().getHeight();
                    float ratio = Math.min(1f, (float) maxSize / Math.max(w, h));
                    decoder.setTargetSize(Math.max(1, Math.round(w * ratio)), Math.max(1, Math.round(h * ratio)));
                    decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
                });
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                // Preserve alpha while keeping previews bounded; original files are never changed.
                bitmap.compress(Bitmap.CompressFormat.WEBP, 90, bytes);
                JSObject value = new JSObject();
                value.put("data", "data:image/webp;base64," + Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP));
                call.resolve(value);
            } catch (Exception e) { call.reject("圖片不存在、無法解碼或未取得讀取授權。", e); }
            catch (OutOfMemoryError e) { call.reject("圖片過大，裝置記憶體不足。"); }
            finally { if (bitmap != null) bitmap.recycle(); }
        });
    }
}
