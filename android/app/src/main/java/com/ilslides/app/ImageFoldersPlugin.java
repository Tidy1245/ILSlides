package com.ilslides.app;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.ImageDecoder;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;

@CapacitorPlugin(name = "ImageFolders")
public class ImageFoldersPlugin extends Plugin {
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
                Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
                JSArray images = new JSArray();
                String[] projection = {DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE};
                try (Cursor cursor = getContext().getContentResolver().query(children, projection, null, null, null)) {
                    if (cursor == null) throw new IllegalStateException("目錄無法讀取");
                    while (cursor.moveToNext()) {
                        String mime = cursor.getString(2), name = cursor.getString(1);
                        if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) continue;
                        boolean isImage = mime != null && mime.startsWith("image/");
                        if (!isImage && name != null) isImage = name.toLowerCase(java.util.Locale.ROOT).matches(".*\\.(jpg|jpeg|png|webp|gif|heic|heif|bmp|avif)$");
                        if (!isImage) continue;
                        JSObject image = new JSObject();
                        image.put("uri", DocumentsContract.buildDocumentUriUsingTree(tree, cursor.getString(0)).toString());
                        image.put("name", name == null ? "未命名圖片" : name); images.put(image);
                    }
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
        execute(() -> {
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
