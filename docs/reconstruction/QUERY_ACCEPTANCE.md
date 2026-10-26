# 車輛／作業區使用查詢交付驗證

日期：2026-10-10。使用者授權「幫我改排版」。需求以交接及後續修訂為準，獨立布局見 [QUERY_LAYOUT_SPEC](QUERY_LAYOUT_SPEC.md)，啟動／部署見 [QUERIES_PREVIEW](../../deploy/QUERIES_PREVIEW.md)。

## 完成範圍

- A：來源標題、篩選卡、動態篩選／狀態快選、11欄有框線表格、同單編號／狀態／操作合併、列內編輯／刪除／下一階段／軌跡。需求類別顯示在原查詢欄，沒有加回先前移除的申請緣由輸入。
- D：標題旁新增、8欄表格、編號／操作合併、查看／編輯／刪除；來源沒有的通用分類tabs及篩選卡已從此入口移除。
- 車輛資產使用紀錄連到指定車輛查詢，附來源提示與返回。全部、E及歷史查詢保留；詳情／編輯維持目前深層路由与刷新。
- React／HTML／CSS自行實作；沒引入Form.io／遠端Schema／新套件，沒有後端或資料庫修改。

## 執行與結果

```bash
npm run build
env LD_LIBRARY_PATH=/home/c113118138/.cache/polimax-browser-deps/usr/lib/x86_64-linux-gnu npm run test:queries
env LD_LIBRARY_PATH=/home/c113118138/.cache/polimax-browser-deps/usr/lib/x86_64-linux-gnu npm run test:sidebar
```

| 檢查 | 結果與證據 |
| --- | --- |
| TypeScript＋Vite | 通過；dist的JS為index-ChDKc4GH.js、CSS為index-B9SC2D4s.css |
| 查詢頁驗證 | 7組通過；[結果及幾何資料](screenshots/queries/results.json)；pageerror 0 |
| 側欄相容 | 6組通過；[結果](screenshots/queries/sidebar-results.json)；pageerror 0 |
| 可操作預覽 | 18024 health回ok／preview／sqlite／test_data=true；A深層URL回200並引用上述最新資源 |
| 既有服務 | 5173／5174程序仍為原PID 1308318／1308314；本次沒有停止或重啟正式服務 |

查詢7組包括：

1. A來源欄序、多時段3欄rowSpan、不同表單計數、車牌與需求映射、非台北瀏覽器下完整台北時間及秒數。
2. 車牌／明細業務人員／地點逐時段篩選、篩後rowSpan重算、結束當日全日包含、需求／狀態切換與清除、無結果。
3. 列內下一階段讀最新revision、透過真實隔離API保存發車、清單更新及改為發車抵達入口；編輯與軌跡帶值。
4. D來源欄序、2欄rowSpan、時段計數、新增／查看／編輯入口、實際修改開始／結束時間保存及回讀、刷新。
5. 兩頁1440／900／769／768／390尺寸，20px內距、字級、框線、欄寬、表內橫捲及整頁無橫溢出。
6. 真實唯讀身分；摘要不能查看／操作、owner限制及直接URL缺read被阻擋的fixture；指定車輛來源提示／返回、E及歷史入口。
7. A/D空資料、查詢失敗後重試、資源載入失敗使用保存的snapshot；刪除取消、失敗後紀錄保留、真實API刪除後清單同步及404回讀。

### 窄畫面幾何

| 寬度 | 內容表格容器 | A表格捲動寬 | D表格捲動寬 | 整頁橫溢出 |
| --- | --- | --- | --- | --- |
| 1440 | 1150 | 1332 | 1150 | 0 |
| 900 | 610 | 1332 | 961 | 0 |
| 769 | 479 | 1332 | 961 | 0 |
| 768 | 728 | 1332 | 961 | 0 |
| 390 | 350 | 1332 | 961 | 0 |

768px時側欄切換抽屜，主內容恢復全寬；因此768比769有更多表格可視寬度。A桌面也保留原欄寬並可横捲，沒有壓窄欄位或改欄序以硬塞入畫面。

## 畫面證據

| 畫面 | 截圖 |
| --- | --- |
| A桌面／右端操作 | [左端](screenshots/queries/A-desktop.png)、[操作端](screenshots/queries/A-desktop-actions.png) |
| A手機／右端操作 | [左端](screenshots/queries/A-mobile.png)、[操作端](screenshots/queries/A-mobile-actions.png) |
| A狀態篩選／空資料 | [狀態篩選](screenshots/queries/A-status-filter.png)、[空資料](screenshots/queries/A-empty.png) |
| D桌面 | [桌面](screenshots/queries/D-desktop.png) |
| D手機／右端操作 | [左端](screenshots/queries/D-mobile.png)、[操作端](screenshots/queries/D-mobile-actions.png) |

截圖是本專案重建結果。資料全為示範／匿名測試資料，不是正式案件。

## 變更與相容邊界

新增`src/BookingQueries.tsx`、`src/queries.css`、`tests/queries.mjs`；`Bookings.tsx`分派A/D而保留通用元件，`main.tsx`引入局部樣式，`Assets.tsx`補kind及resource入口，`tests/sidebar.mjs`按新查詢頁驗證分類切換。package.json新增test:queries，既有依賴不變。README、PROJECT_SPEC、ACCEPTANCE及重建索引同步加入本規格。

本輪7組測試使用18029、6組側欄測試使用18027，均為一次性SQLite與附件目錄，測後已回收。真實寫入只在隔離API完成，权限／摘要／API失敗以瀏覽器fixture補足。現行E表單、B/C欄位與日曆程式沒有為此次排版更動，E及歷史查詢入口有相容檢查；不把本輪稱為重新完成全部ABCDE驗收。

尚未取得原站正式截圖與全域CSS最终疊加，字體、圖示原檔及像素差異仍是U項；以靜態證據及本機相對位置規格交付。查看／編輯使用目前自製表單與正常路由，保留後端權限／owner／revision及未保存保護，不恢復來源Form.io浮層或歷史錯誤處理。正式SSO、PostgreSQL、實際定位資料及正式部署需按原驗收矩陣另驗，未寫成已通過。
