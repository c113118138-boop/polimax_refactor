# 原站其餘畫面補齊驗收

日期：2026-10-11。接續使用者要求，登入頁、英文小標、介紹文案與裝飾圖示保留，其餘以原站實際掛載 JSX 重建；不使用 Form.io。布局規則見 [SITE_PARITY_LAYOUT_SPEC](SITE_PARITY_LAYOUT_SPEC.md)，來源索引見 [SITE_PARITY_SOURCES.json](SITE_PARITY_SOURCES.json)，操作／部署見 [SITE_PARITY_PREVIEW](../../deploy/SITE_PARITY_PREVIEW.md)。

## 失敗處接續與完成內容

重新讀取交接、計畫、來源清單及現行檔案／差異後確認，失敗的 `MapLayout.tsx`／`maps.css` 新增補丁沒有套用；已完成的資產、歷史、階段查詢與彈窗仍在。以拆分補丁接續新地圖布局、接線與驗證，沒有使用 git reset／checkout 還原其他變更。

| 完成項目 | 實作 |
| --- | --- |
| 原資產資料表 | CarList六欄、EquipmentList五欄、Beacon四欄，列內編輯／刪除、原ID及資訊入口 |
| 車輛／儀器資料 | 藍色標題卡、兩欄資訊、滿行設備／配件／備註／三類文件，車輛五分頁 |
| 車輛紀錄 | 保險九欄、成本六欄、維護表＋保養廠檔案＋管理人員同頁，沿用 CRUD |
| 儀器新增／文件 | 原廠商選項、配件增減／自訂／總数；使用手冊、保固書、採購文件保存／回讀 |
| 附件操作 | 多附件選擇、頁內圖片／PDF預覽、下載、缺檔錯誤与可關閉 |
| 歷史／B/C | 完成 A 的11欄／總里程／合併列／四查看操作；B/C分開五欄／篩選／新增与修訂 |
| 自製表單浮層 | 原800px查看／編輯尺寸，B/C出發与抵達同看，保留深層路由及離頁保護 |
| 定位 | 車輛即時、軌跡、FindMy、場內掃描各自頁面；左350px、右地圖／表格、手機右側抽屜 |
| 既有功能 | 主畫面、ABCDE与有效E、側欄、權限、owner、revision、草稿、保存及深層刷新保留 |

主要新增元件：AssetPresentation、SourceFiles、SourceEditors、StageQueries、LocationPages、MapLayout，以及 parity.css／maps.css。舊 Maps 與階段通用列表的實作保留但不掛載，避免對其他既有修改做整檔還原。

## 本輪實際執行結果

全部以下檢查最終通過；同埠測試依序執行。各瀏覽器測試使用臨時 SQLite／附件与自己的隔離服務，結束回收資料。失敗保存、部分 UI 權限與位置資料的 fixture 在結果文件中標記，不當成真正式上游結果。

| 命令 | 結果與範圍 |
| --- | --- |
| `npm run check` | 通過TypeScript |
| `npm run build` | 通過，2,652 modules；`index-VTXP0Iz6.css`、`index-NTnwTRkR.js` |
| `npm run test:site-parity` | 11組；原欄序、CRUD保存／回讀、三類文件、預覽／缺檔、歷史里程／合併、彈窗、定位尺寸与手機、自己的B修訂／其他人不可編輯、唯讀 |
| `npm run test:forms` | 6組；A七種需求、E七種類別、D區域、B/C四階段、四種照片、草稿与取消、欄位權限 |
| `npm run test:sidebar` | 6組；原群組／巢狀／固定底部、頁面入口、1440/900/769/768/390、手機焦點／关闭、唯讀、空／錯誤與重試 |
| `npm run test:navigation` | 10組；未保存離頁／返回／刷新／登出、保存与上傳中保護、B草稿、B/C修訂及部分read權限 |
| `npm run test:queries` | 7組；A/D欄序／多時段合併／台北秒數、篩選、實際階段／D保存、權限／owner、刪除与重試 |
| `npm run test:browser` | 桌面完整 A→B→C、秒數／時區／照片／修訂、各模組与唯讀手機入口通過 |
| `AMS_TEST_MOBILE=1 npm run test:browser` | 同一完整流程以390px操作通過，FindMy右側抽屜與Major正常 |
| `node tests/browser_location.mjs` | 數值查詢、刷新、無座標軌跡不連假線、FindMy空結果通過；位置回應是匿名fixture |
| `npm run test:api` | 14項；保存／衝突／修訂／權限／CRUD／附件／流程／定位契約；PDF inline，HTML等仍下載 |
| `.venv/bin/python -m unittest discover -s tests -p 'test_departure_access.py'` | 9項；發車owner與申請人／摘要及明細权限 |
| `npm run test:asset-files` | 3項；正式相容Repository以臨時SQLite驗有／無原三類文件欄位、重開／清除／備份、交易失敗還原；不讀正式帳密、不改DDL |

測試已隨新 DOM 更新：唯讀 fieldset 包覆下的表單區塊、抵達彈窗內禁用出發里程、藍色資訊卡的重複名稱標題，以及原資料表取代舊資產卡片。保留業務／權限／保存的斷言；右側抽屜幾何等待進場動畫完成後測量。

## 尺寸與畫面證據

最終 [site-parity結果JSON](screenshots/site-parity/results.json) 保存16組定位幾何與11組通過項目。四頁在1440／769px左側實測350px；768／390px左面板隐藏。390px抽屜351px、右側貼齊；表格橫捲限制在容器，頁面橫向溢出均0。

[截圖索引](screenshots/site-parity/README.md) 保存34張最終匿名測試截圖。代表畫面：

| 畫面 | 桌面 | 手機／相關 |
| --- | --- | --- |
| 車輛清單与資料 | [清單](screenshots/site-parity/CarList-desktop.png)、[資訊卡](screenshots/site-parity/Vehicle-profile-desktop.png) | [清單](screenshots/site-parity/CarList-mobile.png)、[資訊卡](screenshots/site-parity/Vehicle-profile-mobile.png) |
| 儀器 | [清單](screenshots/site-parity/EquipmentList-desktop.png)、[新增](screenshots/site-parity/Equipment-create-desktop.png)、[資訊](screenshots/site-parity/Equipment-profile-desktop.png) | [資訊](screenshots/site-parity/Equipment-profile-mobile.png)、[附件預覽](screenshots/site-parity/Asset-file-preview.png) |
| 車輛五分頁 | [保險](screenshots/site-parity/Insurance-desktop.png)、[成本](screenshots/site-parity/Cost-desktop.png)、[維護／檔案／人員](screenshots/site-parity/Maintenance-desktop.png) | 窄螢幕表內橫捲与卡片直排 |
| 歷史紀錄 | [11欄](screenshots/site-parity/History-desktop.png)、[主表浮層](screenshots/site-parity/History-main-dialog.png)、[B浮層](screenshots/site-parity/History-stage-dialog.png) | [手機](screenshots/site-parity/History-mobile.png)；右側操作可在表格橫捲查看 |
| B/C查詢 | [B](screenshots/site-parity/Stage-B-desktop.png)、[C](screenshots/site-parity/Stage-C-desktop.png) | [C手機](screenshots/site-parity/Stage-C-mobile.png) |
| 四定位頁 | [即時](screenshots/site-parity/Positions-desktop.png)、[軌跡](screenshots/site-parity/Trajectory-desktop.png)、[FindMy](screenshots/site-parity/FindMy-desktop.png)、[場內](screenshots/site-parity/Scans-desktop.png) | [即時抽屜](screenshots/site-parity/Positions-mobile-drawer.png)、[軌跡](screenshots/site-parity/Trajectory-mobile-drawer.png)、[FindMy](screenshots/site-parity/FindMy-mobile-drawer.png)、[場內](screenshots/site-parity/Scans-mobile-drawer.png) |
| Beacon | [四欄](screenshots/site-parity/BeaconList-desktop.png) | [手機](screenshots/site-parity/BeaconList-mobile.png) |

視覺檢查包含車輛雙欄資訊卡、設備新增配件控制、歷史表格／合併与手機右側抽屜。最後補齊FindMy六位小數精確座標及手機選中設備／更新時間提示；定位浮層建立獨立層級、手機查詢按钮固定右下角，並在11組全站檢查中實際開啟／關閉頂部選單驗證不被覆蓋。手機流程与定位契約亦通過。圖片佔位与保留文案按使用者例外处理。測試位置為匿名fixture；OpenStreetMap外部圖資本輪有正常載入，不把圖資或真定位來源當本專案生成資料。

## 操作預覽與證據限制

18024已啟動隔離預覽，health為 `mode=preview/database=sqlite/test_data=true`，深層 `/vehicles/1`回SPA与本次 build。原5173／5174 PID仍1308318／1308314，未重啟；不讀寫正式資料庫。可操作入口：<http://163.18.26.228:18024/>。

U：未取得原站逐頁正式截圖與最後字體／CSS疊加，故靜態來源可確認的欄序、分區與比例已實作，不能宣稱逐像素一致。真公司SSO、正式PostgreSQL、外部GPS／Apple／MQTT与跨主機恢復沒有在本輪重驗；不可用demo通過代替。儀器文件与PDF預覽正式發布時必須同步後端程式並備份equipment-files，詳見部署文件。

R：新增B/C仍需有效A父單，E保持可用；不重現歷史500、無父單、永久loading、硬編碼身分、失效保存或弱權限。素材／圖示与保留文案不列成未完成項目。
