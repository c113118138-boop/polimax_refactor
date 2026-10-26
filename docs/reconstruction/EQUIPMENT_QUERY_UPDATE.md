# 儀器查詢與側欄修訂

日期：2026-10-12。依使用者要求移除側欄的「借用紀錄／出回程紀錄」整合入口，儀器使用查詢改為作業區的表格樣式，並移除上方「全部預約／車輛借用／作業區／儀器借用」分類列。各類查詢仍可獨立使用，既有直達路由及借用資料保留。

## 畫面與操作

E入口 `/bookings?kind=E` 顯示「儀器借用紀錄（共 N 筆）」及有權限時的新增按鈕。表格沿用D的20px外距、灰色表頭、框線、欄寬、橫向捲動與查看／編輯／刪除排列。十欄包含儀器名稱／編碼、借用類別、借用時間、使用人員、申請人、既有狀態及建立時間；同單多時段合併編號、狀態及操作。完整規則見 [QUERY_LAYOUT_SPEC](QUERY_LAYOUT_SPEC.md)。

側欄「借用中」依權限顯示：車輛使用查詢、作業區使用查詢、儀器使用查詢、發車紀錄查詢、還車紀錄查詢。只有還車read的帳號仍可使用還車入口。詳見 [SIDEBAR_LAYOUT_SPEC](SIDEBAR_LAYOUT_SPEC.md)。

本次E布局是使用者明確指定的延伸，沒有原站同頁截圖證據；不將它標為原站還原證據。自行實作React／HTML／CSS，沿用既有API、自製表單與權限，沒有Form.io或新套件。

## 驗證

- `npm run build`：TypeScript與Vite成功。
- `test:queries`：9組通過，包含A/D回歸、E多時段資料、設備名稱／編碼、實際查看／編輯保存回讀、重新整理、唯讀／owner／read限制、空資料與實際刪除。1440／900／769／768／390px均無整頁橫向溢出。
- `test:sidebar`：6組通過，包含移除重複入口、三類表格直達及刷新、其他導覽、桌面收合與手機焦點／關閉。
- `test:navigation`：10組通過，包含部分權限與只有C可讀時的還車入口，以及既有未保存／上傳／離頁保護。
- 以上測試使用各自的一次性隔離資料與API；不寫入正式資料。瀏覽器無pageerror。
- 5173、5174與18024均提供本次建置：`index-CpYRgmil.js`、`index-gkof4Rkh.css`。既有5173／5174服務未重啟。

測試結果快照：[查詢9組](screenshots/equipment-query-2026-10-12/queries-results.json)、[側欄6組](screenshots/equipment-query-2026-10-12/sidebar-results.json)、[導覽10組](screenshots/equipment-query-2026-10-12/navigation-results.json)。預覽實測：[表頭／側欄／手機幾何](screenshots/equipment-query-2026-10-12/verification.json)、[服務建置](screenshots/equipment-query-2026-10-12/serving-build.json)。

## 截圖與預覽

- [桌面及展開後側欄](screenshots/equipment-query-2026-10-12/E-desktop.png)
- [手機表格](screenshots/equipment-query-2026-10-12/E-mobile.png)
- [手機捲至操作欄](screenshots/equipment-query-2026-10-12/E-mobile-actions.png)

隔離预覽：[儀器使用查詢](http://163.18.26.228:18024/bookings?kind=E)，先選示範身分登入。上述預覽截圖只讀取現有示範資料，沒有建立或刪除借用紀錄。啟動／部署沿用 [QUERIES_PREVIEW](../../deploy/QUERIES_PREVIEW.md)，重建dist後重新整理既有網站即可。
