# 使用查詢預覽與部署

日期：2026-10-10。這次只調整車輛／作業區查詢前端；正式部署仍依 [README](README.md)、[STANDALONE](STANDALONE.md)。

2026-10-12追加：D灰色表頭、E儀器表格與側欄重複入口移除，仍沿用以下啟動／重建方式。只有前端與布局文件變更，無後端重啟或資料migration；既有服務重建dist後重新整理即可。

此輪驗證與桌面／手機截圖見 [EQUIPMENT_QUERY_UPDATE](../docs/reconstruction/EQUIPMENT_QUERY_UPDATE.md)。

## 可操作隔離預覽

在專案根目錄完成既有依賴安裝後：

```bash
npm run build
npm run preview:main
```

服務預設18024，資料及附件在`.preview/main-screen`，demo SQLite與正式資料完全分離。先選示範身分「進入工作空間」，再從側欄「借用中」選「車輛使用查詢」或「作業區使用查詢」。也可直達：

- `http://localhost:18024/bookings?kind=A`
- `http://localhost:18024/bookings?kind=D`
- `http://localhost:18024/bookings?kind=E`（儀器表格）
- `http://localhost:18024/bookings?kind=A&resource=ID`（指定車輛）

此入口不代表正式SSO測試。預覽已啟動時不再占用同一埠，重建dist後重新整理即可。端口可用AMS_PREVIEW_PORT覆寫；停止只向該預覽程序送SIGTERM，不停止5173／5174。

## 重跑驗證

```bash
npm run build
npm run test:queries
npm run test:sidebar
```

`test:queries`在18029啟動一次性隔離API，明確覆寫AMS_DATA_DIR與PREVIEW_DATA_DIR、demo模式與空資料庫URL，測後清除資料及服務。測試透過真實隔離API建立多時段A/D、保存發車、編輯與刪除；摘要／owner／錯誤狀態用瀏覽器fixture。不改正式資料，不呼叫外部通知／SSO。

Playwright需要正常安裝的Chromium與系統函式庫。本工作站若需要快取函式庫，可執行：

```bash
env LD_LIBRARY_PATH=/home/c113118138/.cache/polimax-browser-deps/usr/lib/x86_64-linux-gnu npm run test:queries
env LD_LIBRARY_PATH=/home/c113118138/.cache/polimax-browser-deps/usr/lib/x86_64-linux-gnu npm run test:sidebar
```

該路徑只用於本機測試，不是網站啟動或部署依賴。新環境依正常Playwright安裝方式準備瀏覽器。

## 發版範圍

更新`BookingQueries.tsx`、`queries.css`、`Bookings.tsx`分派、`main.tsx`樣式import及`Assets.tsx`使用紀錄URL，重建並一致發布dist。没有後端／DB結構或資料migration，也不新增套件。保留原API、SSO、深層路由fallback及服務管理方式；正式上線需用原部署流程驗證代表帳號、既有資料、read／owner／欄位遮罩與深層路由刷新。

布局與差異見 [QUERY_LAYOUT_SPEC](../docs/reconstruction/QUERY_LAYOUT_SPEC.md)，截圖與實測結果見 [QUERY_ACCEPTANCE](../docs/reconstruction/QUERY_ACCEPTANCE.md)。本次不聲稱已驗證正式SSO、PostgreSQL或原站最終像素。
