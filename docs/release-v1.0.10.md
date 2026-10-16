ILSlides v1.0.10

- 移除圖片瀏覽與轉場時畫面下方短暫出現的「讀取中」提示。
- 集合與資料夾挑圖搜尋框移除內側的瀏覽器清除叉號，保留右側 App 清除按鈕。

下載 ILSlides1-0-10.apk，可覆蓋安裝；Android 9 以上，versionName 1.0.10、versionCode 11，沿用相同 debug 簽章。

驗證：62 項 TypeScript 單元測試、正式建置、Chromium 延遲圖片讀取／切圖及兩個搜尋框清除功能驗證、5 項 Android 快取測試、Android 建置與 lint、APK 版本與簽章檢查通過。

UI 原生 bridge 與圖片使用模擬資料，未接 Android 實機。App 不修改來源圖片。

附 SHA256SUMS.txt。
