# 主畫面預覽與部署補充

日期：2026-10-10。本文件記錄主畫面與共用框架；接續側欄修訂及已完成ABCDE各有獨立驗收文件。完整正式部署仍依本目錄README.md、STANDALONE.md；本文件不代表正式SSO、PostgreSQL或搬機已重新驗收。

## 獨立依賴

React、TypeScript、Vite、FullCalendar既有免費套件、FastAPI及本專案後端。資源日、小日曆、篩選及素材佔位為本機React／HTML／CSS；不需要Form.io套件／renderer／服務、遠端Schema、原系統目錄、外部工作區或研究時截圖。

## 隔離可操作預覽

在專案根目錄執行：

```bash
npm ci
# 新環境依 deploy/STANDALONE.md 建立 .venv 並安裝後端依賴。
npm run check
npm run build
npm run preview:main
```

入口 http://localhost:18024/。伺服器綁定0.0.0.0，可從同網路以主機IP:18024存取；這是示範登入預覽入口。預設顯示管理員、借用人、唯讀、草稿身分；選身分後「進入工作空間」。按Ctrl+C停止。可用AMS_PREVIEW_PORT覆寫預覽埠，例如 `AMS_PREVIEW_PORT=18025 npm run preview:main`。

需要離開終端後持續保留隔離預覽時，可在build完成後執行：

```bash
nohup node scripts/preview-main.mjs > /tmp/polimax-main-preview.log 2>&1 < /dev/null &
curl -fsS http://127.0.0.1:18024/api/health
```

先確認18024沒有其他服務；日誌在`/tmp/polimax-main-preview.log`，持久示範資料仍在`.preview/main-screen`。以`ss -lntp '( sport = :18024 )'`查明此隔離預覽程序後向它發送SIGTERM停止，不要停止5173／5174。背景命令不是正式部署服務管理方式。

scripts/preview-main.mjs 明確使用AMS_DATABASE_MODE=demo、AMS_DATA_DIR與PREVIEW_DATA_DIR均指向專案內`.preview/main-screen`、空PREVIEW_DATABASE_URL，並停用外部選項／報表／假日／政策檔案覆寫。隔離SQLite与附件／政策在該目錄持久保存，不使用正式`.data`與資料庫；`.preview/`已git忽略。不要把此預覽命令當正式SSO入口。既有5173／5174服務不由此命令停止或重啟。

## 主畫面測試與畫面證據

```bash
npm run build
npm run test:calendar
npm run test:sidebar # 18027一次性資料；側欄截圖與尺寸
npm run test:navigation # 18028一次性資料；離頁、草稿、部分read權限
node tests/calendar-touch.mjs # 需先啟動18024隔離預覽
npm run test:browser
AMS_TEST_MOBILE=1 npm run test:browser
```

test:calendar在18022啟動一次性API，明確覆寫兩個資料目錄，使用临時SQLite，測後回收服務與測試資料；截圖、結果JSON、幾何尺寸保留於test-results/main-screen。已確認的交付畫面另保留在docs/reconstruction/screenshots，不依賴/tmp。

Playwright需要可用Chromium。tests/calendar.mjs只在本機存在研究瀏覽器函式庫時對瀏覽器子程序設LD_LIBRARY_PATH；缺少時使用環境正常瀏覽器安裝。這個路徑不是交付網站依賴。舊test:browser如遇libnss3等函式庫錯誤，本機可依既有環境設定瀏覽器所需LD_LIBRARY_PATH，再執行；新機應安裝正常瀏覽器依賴。

## 正式部署時的變更

本次正式前端需更新src與重建dist；正式API／資料契約、SSO、權限及保存維持既有。demo_app.py僅修正示範環境auth/config需公開讀取的既有錯誤；正式legacy_api.py本來已允許該公開設定端點。

由部署人員按原部署文件確認環境、建置、更新dist並使用原服務方式載入。正式入口需要驗證登入、首頁、四視圖、小日曆、篩選、權限與既有資料；不把隔離demo結果標成正式相容或真SSO測試通過。本批沒有重啟正式服務或修改正式資料。

素材替換、布局規則與未確認細節見docs/reconstruction/LAYOUT_SPEC.md；每段完成與驗收見docs/reconstruction/MAIN_SCREEN_ACCEPTANCE.md。

## 接續側邊欄更新

側欄規格／入口映射見 [SIDEBAR_LAYOUT_SPEC](../docs/reconstruction/SIDEBAR_LAYOUT_SPEC.md)，截圖及驗證見 [SIDEBAR_ACCEPTANCE](../docs/reconstruction/SIDEBAR_ACCEPTANCE.md)。更新`Sidebar.tsx`、`sidebar.css`及App／main接線；Assets／Bookings／Maps補側欄入口的query參數。此批沒有後端／SQL變更，部署仍須重建並更新dist；不需要Form.io或原系統環境。

`npm run test:sidebar`在18027啟動隔離API，以臨時資料目錄保存SQLite；API清單壓力、刪除旗標、空／錯誤狀態僅使用瀏覽器匿名fixture。結束回收服務與臨時資料，輸出於`test-results/sidebar`，交付截圖另存於`docs/reconstruction/screenshots/sidebar`。

固定底部「料件管理」沿用來源公開網址`https://materials.54ucl.com`；只有使用者點擊才開新分頁，預覽啟動不接外部服務。若日後替換網址，修改`src/Sidebar.tsx`的料件anchor並重建dist，沒有從工作區外讀取env.js的部署依賴。實際料件站可連入性及SSO登出需於正式環境另驗。

## 接續離頁安全及read權限

加入`NavigationGuard.tsx`，入口改用同版React Router的createBrowserRouter／RouterProvider，既有頁面URL及API不變。BorrowingForms、Stages、App接入單一離頁保護，ui浮層用aria-labelledby連接標題。Sidebar按頁面／API的read權限隱藏入口；不新增套件、資料欄位或migration。正式部署仍只需重建並更新前端dist；新舊靜態資源按既有部署方式一致發布。

`npm run test:navigation`使用兩個明確臨時資料目錄、18028隔離API，測後清除；輸出`test-results/navigation`。失敗保存／登出、上傳延迟及auth/me部分權限為瀏覽器fixture；成功保存、階段修訂與照片使用真實隔離API。操作、截圖及結果見 [NAVIGATION_SAFETY_ACCEPTANCE](../docs/reconstruction/NAVIGATION_SAFETY_ACCEPTANCE.md)。正式上線仍需原部署文件要求的SSO、PostgreSQL、深層路由刷新及代表身分驗收。
