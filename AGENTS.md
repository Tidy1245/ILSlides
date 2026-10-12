# ILSlides 開發規範

- 繁體中文介面；Vue 3 + TypeScript + Capacitor 8 Android。
- 圖片使用 Android SAF 目錄授權，僅讀取使用者所選目錄，不修改原始檔。
- Android minimum API 28，JDK 21 建置。
- 建置：npm test → npm run build → npx cap sync android → android/gradlew assembleDebug。
- GitHub 發布流程參照 Video-Box：更新 package.json / lock 與 Android versionCode / versionName，更新本文件目前開發進度，提交並推送 main，建立 Release 上傳 APK。
- APK 命名 ILSlides<major>-<minor>-<patch>.apk；發布時附 SHA256SUMS.txt。
- 不提交 local.properties、建置產物、node_modules、簽章金鑰或憑證。

## 目前開發進度

### v1.0.0（2026-10-12）

- 新增藍黑漸層、圓角卡片的手機圖片集合介面。
- 支援多集合建立、重新命名、重新選擇來源目錄與移除集合。
- Android 系統目錄選擇器與持久讀取授權，原始圖片保留在目錄。
- 左右滑動與箭頭循環瀏覽、360ms 淡入淡出、解碼後切換及下一張預讀。
- 沉浸瀏覽、Android 返回鍵、空目錄與授權錯誤提示。
- EXIF 方向處理與縮圖／預覽尺寸限制、有限圖片快取。
- 前端建置、3 項單元測試、手機瀏覽器 UI 自動測試通過；未連接 Android 實機。
