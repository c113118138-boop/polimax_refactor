# 原站其餘畫面預覽與部署

日期：2026-10-11。本輪承接主畫面、ABCDE、側欄及 A/D 查詢，補齊歷史、B/C 查詢、資產、文件預覽與定位。範圍與差異見 [SITE_PARITY_LAYOUT_SPEC](../docs/reconstruction/SITE_PARITY_LAYOUT_SPEC.md)，測試／截圖見 [SITE_PARITY_ACCEPTANCE](../docs/reconstruction/SITE_PARITY_ACCEPTANCE.md)。

## 可操作預覽

在專案根目錄：

```bash
npm run build
npm run preview:main
```

入口 `http://localhost:18024/`；本機公開預覽 `http://163.18.26.228:18024/`。選示範管理員後進入，可由側欄操作；也可使用借用人／唯讀／草稿角色。這是隔離 SQLite，不是正式 SSO。測試新增、刪除只作用於 `.preview/main-screen`；不要拿正式資料貼入預覽。

| 操作 | URL |
| --- | --- |
| 日曆 | `/` |
| A/D/E 查詢 | `/bookings?kind=A`、`?kind=D`、`?kind=E` |
| 發車／還車 | `/stages?kind=B`、`?kind=C` |
| 歷史紀錄 | `/bookings?history=1` |
| 車輛／儀器／Beacon | `/vehicles`、`/equipment`、`/beacons` |
| 新增資產 | `/vehicles?create=1`、`/equipment?create=1` |
| 資產詳情 | 點清單車牌／設備名稱或側欄資產；`/:id` 深層路由可刷新 |
| 車輛即時／軌跡 | `/positions`、`/positions?view=history` |
| 設備即時／場內 | `/findmy`、`/scans` |

歷史只列已完成 A；如清單無資料，從 A 依四階段完成後即可查看里程。新增 B/C 必須選適用流程中的 A，不能建立孤立階段。手機定位頁右下查詢按钮開右側面板。

伺服器綁定0.0.0.0、預設18024；`AMS_PREVIEW_PORT`可覆寫。確定18024無其他服務後，需持續運行時依 [MAIN_SCREEN_PREVIEW](MAIN_SCREEN_PREVIEW.md) 的 nohup 或既有服務管理方法啟動；不要停止5173／5174。本輪沒有重啟正式服務，也沒有寫入正式資料。新機環境準備依 [STANDALONE](STANDALONE.md)。

## 自動驗證

```bash
npm run check
npm run build
npm run test:site-parity  # 18030 一次性資料，匿名定位 fixture
npm run test:asset-files # 相容 repository，臨時 SQLite，無 DDL
npm run test:api
npm run test:forms       # 18026
npm run test:sidebar     # 18027
npm run test:navigation  # 18028
npm run test:queries     # 18029
npm run test:browser     # 18021
AMS_TEST_MOBILE=1 npm run test:browser
node tests/browser_location.mjs # 18022 匿名位置契約
```

同埠測試不要同時執行。測試回收自己的服務與臨時資料；输出留在 `test-results`。交付截圖与結果另保存在 `docs/reconstruction/screenshots/site-parity`。本機 Playwright 若需已安裝研究函式庫，可在整個 Node 命令前加 `env LD_LIBRARY_PATH=/home/c113118138/.cache/polimax-browser-deps/usr/lib/x86_64-linux-gnu`；新機使用正常 Chromium 依賴，不是網站執行依賴。

## 正式部署變更

1. 按現有正式部署流程發布源碼與一致的 build；同步 `src/AssetPresentation.tsx`、`SourceFiles.tsx`、`SourceEditors.tsx`、`StageQueries.tsx`、`LocationPages.tsx`、`MapLayout.tsx`、對應 CSS，以及 App／Assets／Bookings／Stages／Admin／Sidebar／ui／api 接線。
2. 本輪後端有 `legacy_store.py` 儀器三類文件相容保存、`legacy_api.py` PDF inline 預覽；demo_app.py 補階段 applicant_owner 與 PDF 預覽供隔離預覽。正式部署需更新後端程式并依既有服務方式載入，不只覆蓋 dist。
3. 不需要 schema migration 或新套件；有原文件欄位則使用既有欄位，缺欄位則保存於 `AMS_DATA_DIR/equipment-files`。備份／還原要包括 PostgreSQL、uploads、responses、equipment-files 與原有政策／session持久資料；搬機保留整個 `AMS_DATA_DIR`。
4. 明確使用原 `AMS_DATABASE_MODE=postgresql`、原 SSO／資料目錄設定，不能使用 demo 命令作正式入口。部署人員於正式隔離驗收環境核對 owner／部分權限、代表舊儀器文件、寫入與重新啟動回讀、附件下載／圖片／PDF預覽、深層 URL 刷新與真正定位來源。

本輪已跑的隔離測試不代表正式 PostgreSQL／公司 SSO／GPS／Apple／MQTT 已重新驗收。原站沒有逐頁正式截图的部分以靜態 JSX 重建并標記，沒有宣稱逐像素一致。
