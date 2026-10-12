# ILSlides 開發規範

- 繁體中文介面；Vue 3 + TypeScript + Capacitor 8 Android。
- 圖片使用 Android SAF 目錄授權，僅讀取使用者所選目錄，不修改原始檔。
- Android minimum API 28，JDK 21 建置。
- 建置：npm test → npm run build → npx cap sync android → android/gradlew assembleDebug。
- GitHub 發布流程參照 Video-Box：更新 package.json / lock 與 Android versionCode / versionName，更新本文件目前開發進度，提交並推送 main，建立 Release 上傳 APK。
- 每次發布前執行 `npm run release:prepare`，預設 patch +1；只有使用者明確指定時才用 `npm run release:prepare -- <版本>`。一般建置不遞增版號。工具同步 package / lock / Android versionName 並遞增 versionCode。
- APK 命名 ILSlides<major>-<minor>-<patch>.apk；發布時附 SHA256SUMS.txt。
- 不提交 local.properties、建置產物、node_modules、簽章金鑰或憑證。

## 目前開發進度

### v1.0.2（2026-10-12）

- 從集合圖片選擇封面；固定 4:3 裁切視窗，拖曳調整位置、縮放 1～3 倍及重設。
- 封面保存圖片 URI 與裁切參數，重開後重建預覽，不修改原圖。
- 移除首頁四行介紹文字，新增依集合名稱即時搜尋、清除與無結果提示。
- 編輯集合底部固定刪除鍵，確認後刪除此集合、保留原始圖片。
- 11 項單元測試、手機 UI 封面／搜尋／刪除與既有流程、Android 建置及 lint 通過；未連接 Android 實機。

### v1.0.1（2026-10-12）

- 將常用資料夾與圖片集合分開保存，資料夾是快速找圖捷徑。
- 集合改為明確選取的圖片 URI 清單，支援多選、跨資料夾選圖、全選與編輯增減。
- 常用資料夾重開後保留；資料夾新增圖片不會自動加入集合。
- 舊版集合保留名稱並轉成固定圖片清單，原目錄保留為捷徑。
- 新增預設 patch +1 的發布版號工具，版號 UI 從 package.json 讀取。
- 6 項單元測試、手機 UI 自動測試、Android 建置與 lint 通過；未連接 Android 實機。

### v1.0.0（2026-10-12）

- 新增藍黑漸層、圓角卡片的手機圖片集合介面。
- 支援多集合建立、重新命名、重新選擇來源目錄與移除集合。
- Android 系統目錄選擇器與持久讀取授權，原始圖片保留在目錄。
- 左右滑動與箭頭循環瀏覽、360ms 淡入淡出、解碼後切換及下一張預讀。
- 沉浸瀏覽、Android 返回鍵、空目錄與授權錯誤提示。
- EXIF 方向處理與縮圖／預覽尺寸限制、有限圖片快取。
- 前端建置、3 項單元測試、手機瀏覽器 UI 自動測試通過；未連接 Android 實機。
