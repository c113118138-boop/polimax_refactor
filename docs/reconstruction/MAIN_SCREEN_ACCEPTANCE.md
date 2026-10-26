# 主畫面分段交付與驗收

日期：2026-10-10。範圍：布局研究、主畫面、必要共用框架及預覽／驗證文件。ABCDE表單沒有重建；A/B/C的既有流程只作回歸驗證。

## 已交付行為

- 日曆緊接頂欄，桌面右側依序小日曆、收合車牌／已選chip／全選／個選、作業區及保留的儀器篩選；移除原無來源的介紹、統計、後續安排及提示卡。
- 桌面250px側欄、85px頂欄、300px右篩選；≤768px為60px頂欄、280px左抽屜、300px右篩選抽屜與右下浮動鈕。保留現行完整側欄群組、路由直達、刷新、姓名及登出。
- 月／週／資源日／活動列表、上一期／下一期／今天、小日曆、日期與資源篩選同步；假日切換遵循Enabled／Visible權限。
- 資源日自行實作：車牌文字排序、時間對應事件高度、同時事件並列、跨日裁切、營業時段背景、內部捲動、現在時間線、點時段與拖選、末格跨午夜。
- 點事件顯示摘要，完整申請入口保留detail_allowed限制；A/D/E新增入口只顯示允許種類，車輛／開始／結束時段帶入現有路由。保留E事件、篩選與正常保存。
- Logo、profile背景與頭像均有固定比例佔位，後續原圖替換方式見LAYOUT_SPEC.md；沒有用原系統圖片或完整畫面程式當網站依賴。

## 可操作預覽

本機已啟動的隔離示範入口：`http://localhost:18024/`，同網路可使用本機IP的18024埠。選管理員／借用人／唯讀身分後進入工作空間。啟動命令 `npm run preview:main`；停止後可按相同命令重啟。

資料位於`.preview/main-screen`，與正式資料隔離。詳細準備、啟動、停止與正式部署補充见[MAIN_SCREEN_PREVIEW](../../deploy/MAIN_SCREEN_PREVIEW.md)。本批沒有重啟原5173／5174服務、變更SSO設定或寫入正式資料。

## 測試命令與結果

| 命令 | 結果／適用範圍 |
| --- | --- |
| `npm run check` | 通過TypeScript；最終build亦包含同一檢查 |
| `npm run build` | 通過；最終Vite建置2648個模組，沒有Form.io前端依賴 |
| `npm run test:calendar` | 通過8組：9種寬度／斷點、日期同步、車牌操作、四視圖／假日、A/D/E保存回讀／事件／篩選、拖選及原A表带值、路由刷新／抽屜／側欄、唯讀限制；JS pageerror為空 |
| `node tests/calendar-touch.mjs` | 通過真hasTouch觸控20:00～20:30選取、手機資源表內部橫捲／無頁面溢出、零權限選日提示及零資料／通知API呼叫。此命令先確認18024為隔離demo |
| `LD_LIBRARY_PATH=/home/c113118138/.cache/polimax-browser-deps/usr/lib/x86_64-linux-gnu npm run test:browser` | 通過桌面完整A→發車→抵達→還車→抵達、照片保存／API回讀、階段修訂、秒數／非臺北時區、其他模組頁、手機側欄與唯讀權限 |
| `LD_LIBRARY_PATH=/home/c113118138/.cache/polimax-browser-deps/usr/lib/x86_64-linux-gnu AMS_TEST_MOBILE=1 npm run test:browser` | 通過同一完整流程的390px手機／觸控環境及照片／修訂／其他頁面回歸 |
| `git diff --check` | 通過 |

LD_LIBRARY_PATH只為本機研究用瀏覽器函式庫，不是網站或部署必要依賴。這一輪沒有修改正式後端資料契約；正式SSO、正式PostgreSQL相容、真附件生命週期與通知仍按原正式驗收要求另驗，不能用隔離結果替代。

主畫面測試使用一次性SQLite和明確AMS_DATA_DIR／PREVIEW_DATA_DIR；A/D/E確實經API新增後讀回。E取得成功保存及主畫面顯示證據，沒有恢復歷史500或拒絕保存。完整browser測試同樣覆寫兩個目錄，避免本機配置導向正式持久目錄。真觸控補測僅使用既已隔離的18024示範入口。

## 幾何測量

全部寬度的document.scrollWidth與viewport一致，沒有頁面水平溢出。實際JSON保留在[screenshots/results.json](screenshots/results.json)。

| CSS px寬度 | 側欄 | 頂欄 | 日曆主欄 | 右篩選 |
| --- | --- | --- | --- | --- |
| 1440 | 250 | 85 | 890 | 300 |
| 1101／1100 | 250 | 85 | 551／550 | 300 |
| 900 | 250 | 85 | 350 | 300 |
| 769 | 250 | 85 | 219 | 300 |
| 768 | 關閉；抽屜280 | 60 | 768 | 關閉；抽屜300 |
| 481／480 | 關閉；抽屜280 | 60 | 481／480 | 關閉；抽屜300 |
| 390 | 關閉；抽屜280 | 60 | 390 | 關閉；抽屜300 |

1440px日曆左緣x250、上緣y85；右篩選左緣等於日曆右緣。390px日曆左緣x0、上緣y60。資源日2028-02-10 09:00～10:00測試事件top540px／height60px，America/Los_Angeles瀏覽器也正確。桌面拖選12:00～13:30實際回填原A表開始／結束欄，23:30末格結束為翌日00:00。

## 畫面證據

以下均為本次自行實作的隔離畫面，有虛構資料；不是正式原站的對照截圖。

- [桌面月視圖](screenshots/desktop-month.png)
- [桌面展開篩選](screenshots/desktop-filters.png)
- [桌面資源日與A/D/E事件](screenshots/desktop-resource-day.png)
- [手機月視圖](screenshots/mobile-month.png)
- [手機篩選抽屜](screenshots/mobile-filters.png)
- [手機資源日](screenshots/mobile-resource-day.png)
- [手機唯讀資源日](screenshots/mobile-readonly.png)
- [真觸控與零權限結果](screenshots/touch-results.json)

## 修改檔案與必要修正

主畫面：src/Calendar.tsx、src/calendar.css；共用框架／素材位置／新增權限：src/App.tsx，樣式順序：src/main.tsx。預覽：scripts/preview-main.mjs、package.json、.gitignore。測試：tests/calendar.mjs、tests/calendar-touch.mjs、tests/browser.mjs。文件：LAYOUT_SPEC.md、本文件、screenshots、deploy/MAIN_SCREEN_PREVIEW.md，以及根README／PROJECT_SPEC／ACCEPTANCE。

backend/demo_app.py只補入auth/config公開端點，修正既有示範登入「先登入才能讀登入模式」問題；正式legacy_api.py已有同樣公開設定行為。tests/browser.mjs按現有手動駕駛姓名輸入及使用車輛更新過期selector，保留原保存、照片、流程、秒數與權限斷言，沒有為測試改動表單。

## 差異與尚未確認

相對位置及尺寸依靜態來源研究與本次隔離幾何檢查驗證；尚未取得可確認來源的正式主畫面截圖，所以沒有宣稱正式站像素一致。原頁完整CSS疊加／字型、小日曆最後尺寸、480px工具列原排列仍標記U；本次有明確可獨立閱讀的布局值，詳見LAYOUT_SPEC.md。

保留現行全部車輛初始選取、完整路由群組、右上姓名／登出、E事件／篩選／入口，與歷史來源有差異；這些差異依交接要求保留。修正歷史工作間資源ID不匹配、混合時區、選取結束被忽略的缺陷。下一批才重建ABCDE，不把本次未重建的五步表單視為來源布局已驗收。
