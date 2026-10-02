# KFC 用電度數轉檔工具

## GitHub Pages 部署
1. 建立一個新的 GitHub repository。
2. 將 `index.html`、`default-mapping.js` 上傳到 repository 根目錄。
3. Repository → Settings → Pages。
4. Source 選 `Deploy from a branch`，Branch 選 `main` / `(root)`，儲存。
5. 等待 GitHub Pages 網址產生後即可使用。

## 每月操作
1. 開啟「每月用電轉檔」。
2. 上傳台電每月底稿 Excel。
3. 檢查月份、餐廳數與未配對店號。
4. 點「下載 Excel 貼上檔」。
5. 將產出的資料貼入 Power BI 母檔。

## 計算規則
每個電號：`(經常收費度數 + 離峰用電度數 + 週六半尖峰) ÷ (本次抄表日 - 上次抄表日)`；同餐廳多電號再依餐廳代號加總。

## 基本資料更新
在「餐廳基本資料」頁直接匯入餐廳店號選單 Excel。網站會優先讀取日期最新的 `按區_YYYYMMDD` 工作表，更新區域、AC、Group、餐廳代號、餐廳名稱。資料保存在目前瀏覽器的 localStorage。

## 資料安全
Excel 解析與計算都在瀏覽器本機完成；網站不會把台電檔或基本資料上傳到 GitHub。若清除瀏覽器網站資料，需重新匯入基本資料。
