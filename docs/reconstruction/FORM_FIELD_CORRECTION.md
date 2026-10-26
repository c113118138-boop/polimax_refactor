# A／E「申請緣由」欄位修正

日期：2026-10-10。使用者確認原表沒有「申請緣由」，因此移除車輛（A）與儀器（E）新增及編輯畫面的該輸入欄位。原「預約基本資訊／借用人資料」只保留申請日期、申請人，後續區塊依原順序往上銜接；沒有留下隱藏輸入或空白欄位。

現行API、查詢與日曆仍使用`content.title`。新增單送出時自動以既有使用需求／類別填入；修改舊單保留已保存的非空title，避免覆寫歷史資料。這是資料相容處理，不是使用者需填寫的欄位。D及B/C流程、後端驗證、權限與owner／revision规则不變，無SQL或套件變更。

布局規格已同步至 [FORM_LAYOUT_SPEC](FORM_LAYOUT_SPEC.md)，部署說明見 [FORMS_PREVIEW](../../deploy/FORMS_PREVIEW.md)。初批截圖與測試紀錄維持歷史版本；本次截圖及驗證結果另存於`screenshots/form-field-correction/`。

## 驗證紀錄

- `npm run build`通過：`index-DmWKTVu3.js`、`index-bRPEt-df.css`。
- `node tests/forms.mjs`：6組通過。A七種需求、E七種類別都不填此欄位即可保存，回讀title與既有使用需求／類別一致，E重開及修改保存正常；D及B/C回歸也通過。[結果JSON](screenshots/form-field-correction/forms-results.json)。
- `npm run test:navigation`：10組通過。舊單非空title在修訂後保留，未保存離頁、保存失敗、草稿及上傳中保護正常。[結果JSON](screenshots/form-field-correction/navigation-results.json)。
- `npm run test:calendar`：8組通過，包含時段／車輛帶入A新增及保存、深層路由刷新。[結果JSON](screenshots/form-field-correction/calendar-results.json)。
- `git diff --check`通過。

瀏覽器測試使用一次性SQLite及附件目錄，明確覆寫AMS_DATA_DIR與PREVIEW_DATA_DIR，不寫正式資料。正式SSO／PostgreSQL沒有在本次重新驗收。

本機Playwright執行帶入已有瀏覽器函式庫LD_LIBRARY_PATH；網站沒有新增這個路徑依賴。三個回歸結果的pageerror皆為0。

## 修正後畫面

| 表單 | 桌面1440px | 手機390px |
| --- | --- | --- |
| A車輛 | [A-desktop](screenshots/form-field-correction/A-desktop.png) | [A-mobile](screenshots/form-field-correction/A-mobile.png) |
| E儀器 | [E-desktop](screenshots/form-field-correction/E-desktop.png) | [E-mobile](screenshots/form-field-correction/E-mobile.png) |

桌面已目視確認第一區塊只有日期與申請人；各代表寬度與截圖擷取時的頁面橫向溢出皆為0。

隔離預覽：[18024入口](http://163.18.26.228:18024/)。重新整理後開啟車輛或儀器借用新增即可查看；本機已確認預覽提供本次最新JS。
