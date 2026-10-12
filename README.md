# ILSlides

為 Android 手機打造的本機圖片瀏覽 App。藍黑漸層、圓角集合卡片與淡入淡出轉場。

## 安裝

前往 [GitHub Releases](https://github.com/Tidy1245/ILSlides/releases/latest) 下載 **ILSlides1-0-1.apk**，支援 **Android 9（API 28）以上**。與 Video-Box 相同，提供 Capacitor debug 簽章 APK 直接安裝。

## 使用方式

1. 點「新增集合」，輸入名稱。
2. 點「選擇／重新授權資料夾」，選擇圖片來源。App 會記住此資料夾，下次直接點常用資料夾即可開啟。
3. 在縮圖上勾選多張圖片；可切換其他資料夾繼續勾選，或全選目前資料夾。
4. 點「建立集合」。集合只包含已勾選圖片，依挑選順序瀏覽。
5. 打開集合，左右滑動／點箭頭瀏覽，點畫面或「沉浸瀏覽」隱藏操作列。
6. 編輯集合可改名、增加圖片、取消勾選或移除集合；取消編輯不變更已存集合。

常用資料夾是找圖捷徑，集合是獨立的圖片清單。同一張圖片可加入不同集合。資料夾新增圖片不會自動加入既有集合；「重新讀取」只重載集合已選圖片。

## 升級與資料

- v1.0.0 舊集合在首次啟動時轉成固定圖片清單，保留原集合名稱與當時目錄內圖片；原目錄成為常用資料夾捷徑。轉換失敗時可編輯集合重新選圖。
- Android Storage Access Framework 保存目錄讀取授權，圖片不複製、不上傳、不修改。
- 集合名稱、選取的圖片 URI 與資料夾捷徑保存於裝置 WebView localStorage；清除 App 資料／解除安裝後需要重建。
- 目錄挑圖依檔名自然排序，不遞迴讀取子目錄。集合按選取順序瀏覽；左右循環。
- 360ms 淡入淡出，先解碼再切換並預讀下一張；尊重減少動畫設定。
- 預覽長邊最多 2048 像素、封面最多 600、挑圖縮圖最多 320；原圖不變。
- 原生 ImageDecoder 處理 EXIF 方向；格式依裝置解碼器而定，GIF 以靜態預覽顯示。
- 目錄／檔案被移動、刪除或授權失效時，請重新授權資料夾並重新挑圖。
- Android 11 以上限制部分根目錄與 Android/data 等目錄，請選一般圖片子目錄。

## 開發、建置與發布

Vue 3 + TypeScript + Vite + Capacitor 8，自訂 Java ImageFolders 插件。

```powershell
npm ci
npm test
npm run build
npx cap sync android
$env:JAVA_HOME='<JDK 21 安裝目錄>'
cd android
.\gradlew.bat assembleDebug lintDebug
```

SDK 位置由 `android/local.properties` 設定（不提交）。完整 APK 建置與校驗檔可使用 `scripts/build-apk.ps1 -JavaHome '<JDK 21>'`。

**每次發布預設自動遞增 patch 一碼；使用者明確指定時採指定版號。** 發布前執行一次：

```powershell
npm run release:prepare          # 例如 1.0.1 → 1.0.2
npm run release:prepare -- 2.0.0 # 明確指定
```

此工具同步 package.json、package-lock.json、Android versionName，並遞增 Android versionCode。一般建置不改版號。更新 AGENTS.md 與發布說明後，建置 APK、提交推送 main，再建立 GitHub Release 上傳 `ILSlides<版號>.apk` 與 `SHA256SUMS.txt`。

UI 測試：安裝 Playwright 後執行 `npm run dev` 與 `node scripts/ui-smoke.mjs`；可用 `PLAYWRIGHT_MODULE` 指定模組路徑，`APP_URL` 指定測試網址。原生 bridge 使用模擬資料。

## v1.0.1 驗證

- 型別檢查、正式建置、6 項單元測試通過。
- 手機 UI 測試涵蓋多選、常用資料夾重用、集合互不影響、資料夾新增圖片不自動加入、跨資料夾選圖、改名／增減／保存／刪除與舊版轉換。
- Android APK 建置與 lint 通過；APK 簽章與 SHA-256 驗證。
- 此次未連接 Android 實機，目錄持久授權與裝置圖片解碼仍需實機確認。

## 畫面

使用測試圖片，非 App 預載照片。

| 選圖建立集合 | 集合首頁 |
| --- | --- |
| ![選圖](docs/create.png) | ![首頁](docs/collections.png) |
