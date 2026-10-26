# 側邊欄接續重建驗收

日期：2026-10-10。依使用者「請繼續修改主畫面的側邊欄」接續交付。獨立規格見 [SIDEBAR_LAYOUT_SPEC](SIDEBAR_LAYOUT_SPEC.md)，此文件的側欄畫面取代初批平鋪選單證據。

## 操作預覽與完成範圍

[主畫面隔離預覽](http://163.18.26.228:18024/)（本機localhost:18024）：選示範管理員再「進入工作空間」。health確認`mode=preview, database=sqlite, test_data=true`，資料位於`.preview/main-screen`。未重啟5173／5174正式服務；外網可連入性依主機網路設定。

- 來源順序：日曆、借用申請、借用中、公務車使用管理、設備管理、後台資訊管理、資產設備資訊|管理。群組初始收合，原位展開，後續列下移。
- 巢狀公務車／儀器設備、新增入口、車牌／設備名稱；原API順序與有效資產過濾。
- 只有中間選單捲動；品牌、使用者區、料件管理及登出固定。原圖位置與比例繼續預留。
- 現行全部路由仍可到達；A/D/E直接新增、查詢分類、資產新增浮層及軌跡模式帶入URL，刷新保留目前入口。
- 桌面整體收合、手机280px抽屜、Esc／遮罩／選項關閉與鍵盤焦點限制；新增及管理權限沒有繞過既有Guard／API。

## 截圖與測量

截圖為交付版及匿名測試資料。展開資產的壓力圖額外加入36筆瀏覽器清單fixture以驗證捲動，沒有寫入API或正式資產。

| 狀態 | 畫面證據 |
| --- | --- |
| 桌面1440×1000初始收合 | [desktop-closed.png](screenshots/sidebar/desktop-closed.png) |
| 桌面借用／巢狀資產展開 | [desktop-expanded.png](screenshots/sidebar/desktop-expanded.png) |
| 桌面資產清單捲到底 | [desktop-assets-bottom.png](screenshots/sidebar/desktop-assets-bottom.png) |
| 900×844側欄比例 | [tablet-closed.png](screenshots/sidebar/tablet-closed.png) |
| 手機390×844借用展開 | [mobile-expanded.png](screenshots/sidebar/mobile-expanded.png) |
| 手機巢狀清單捲到底 | [mobile-assets-bottom.png](screenshots/sidebar/mobile-assets-bottom.png) |

[完整驗證／幾何JSON](screenshots/sidebar/results.json)。1440、900、769px側欄250px，768與390px抽屜280px；品牌高80／60px、profile140px，頁面橫溢出均0。展開三筆借用子項使下一群組向下144px。長清單捲動前後品牌與底部矩形位置相同，側欄本身scrollTop為0。

## 執行結果

| 命令 | 實測結果 |
| --- | --- |
| `npm run build` | TypeScript及Vite建置通過；`index-C7jXqhyS.js`／`index-bRPEt-df.css` |
| `npm run test:sidebar` | 6組通過，無pageerror；來源順序／初始收合／位移；巢狀清單／API順序／刪除旗標／固定底部；新增／查詢／資產詳情刷新／重開／定位模式／取消登出；五種寬度與手機焦點；唯讀權限；空／失敗狀態 |
| `npm run test:calendar` | 8組通過；日曆四視圖、日期／車牌、A/D/E保存回讀與事件、A帶值、側欄／刷新、手機及唯讀 |
| `LD_LIBRARY_PATH=… npm run test:browser` | 桌面A→B→C完整保存、秒數／時區、階段修訂、全部模組導航、Beacon major、手機導覽與唯讀限制通過 |
| `git diff --check` | 通過 |
| `GET :18024/api/health` | 200，preview／sqlite／test_data=true |

所有瀏覽器測試使用明確的兩個臨時資料路徑與一次性SQLite；沒有操作正式資料、原通知服務或外部料件站。空／錯誤狀態及刪除旗標以瀏覽器匿名fixture驗證。料件測試只核對来源URL及新分頁屬性，未點擊外部站；登出測試核對確認浮層及取消後session仍有效，未驗真SSO。

## 修改與部署

- 新增`src/Sidebar.tsx`、`src/sidebar.css`；App改共用側欄接線，main載入樣式。
- Bookings讀取`kind`設定初始分類；Assets讀取`create=1`開既有浮層，取消清參數；Maps接受`view=history`，Positions按查詢字串重新帶入初始模式。
- 新增`tests/sidebar.mjs`及`test:sidebar`；browser/calendar導覽改用來源群組下CarList入口，原保存／權限斷言保留。
- 更新README、PROJECT_SPEC、ACCEPTANCE、來源清單、布局與實作計畫，以及 [部署補充](../../deploy/MAIN_SCREEN_PREVIEW.md)。此批無後端、SQL或owner政策修改。

正式發布仍依原部署文件重建並更新dist。本次没有重新驗證正式SSO、正式資料、外部料件站及原站逐像素相似度；原圖仍預留，來源／實作證據界限在布局規格內標記。
