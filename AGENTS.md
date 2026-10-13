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

### v1.0.4（2026-10-13）

- 集合頁 Android 系統返回鍵：不在頁首時立即回頂部，在頁首時退出 App。
- 新增集合捲動區離開頂部時，右下方顯示半透明回頂部按鈕，回頂部後隱藏。
- 圖片瀏覽移除下方文字／操作區，保留半透明頂部標題列。
- 圖片初始使用完整視窗、維持比例最大顯示，點擊僅切換標題列；左右滑動與淡入淡出保留。
- 15 項單元測試與手機 UI 返回鍵事件／回頂部／尺寸／標題列／真實觸控滑動及既有流程通過；Android 建置／lint／簽章驗證，未接 Android 實機。

### v1.0.3（2026-10-12）

- 固定頂部列：右側齒輪進入獨立設定頁，版本號移到設定頁。
- 轉場時間滑桿 100～2000ms，預設 360ms，持久保存並套用圖片淡入淡出。
- 底部列左側首頁、右側集合；首頁最多 4 筆最近修改集合。
- 集合頁保留所有管理與搜尋功能，新增字母／建立日期／修改日期的遞增與遞減排序並保存。
- 新建／編輯集合記錄時間；舊集合缺少日期時標示未記錄。
- Hash 頁面路徑與 Android 返回鍵支援設定／集合導覽。
- 15 項單元測試、手機 UI 導覽／首頁上限／排序／設定保存及真實 CSS 轉場時間、Android 建置與 lint 通過；未接 Android 實機。

### v1.0.2（2026-10-12）

- 從集合圖片選擇封面；固定 4:3 裁切視窗，拖曳調整位置、縮放 1～3 倍及重設。
- 封面保存圖片 URI 與裁切參數，重開後重建預覽，不修改原圖。
- 移除首頁四行介紹文字，新增依集合名稱即時搜尋、清除與無結果提示。
- 編輯集合底部固定刪除鍵，確認後刪除此集合、保留原始圖片。
- 11 項單元測試、手機 UI 封面／搜尋／刪除與既有流程、Android 建置及 lint 通過；未連接 Android 實機。
