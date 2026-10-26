# 未保存離頁及側欄讀取權限驗收

日期：2026-10-10。接續主畫面、ABCDE及側欄重建，依使用者授權修正未保存內容跳頁遺失，以及側欄入口與現行read權限不一致。此前各批驗收仍保留原紀錄；本批規則是新增的可用性修正，不宣稱來自原站截圖。

## 已完成行為

| 情境 | 交付行為 |
| --- | --- |
| A/D/E改內容或開著未保存資料列 | 側欄、取消、路由跳頁、瀏覽器返回／前進先顯示「尚未保存的內容」 |
| B/C新增或階段修訂改內容 | 取消、關閉鈕、Esc、遮罩及路由離開使用同一確認 |
| 繼續編輯 | 保留原路由、輸入及本地照片引用，確認窗關閉後恢復原浮層 |
| 放棄變更並離開 | 丟棄本地未保存內容；不自動提交、不推進流程、不物理刪除照片 |
| 保存／上傳中 | 應用程式內確認顯示等待完成訊息、停用放棄；仍可返回編輯視窗等待。瀏覽器關閉／刷新仍由原生提示控制 |
| 保存失敗 | 保留內容、錯誤訊息及離頁保護；成功保存才解除，A沿用修訂產生新ID契約 |
| B/C儲存草稿 | 以手動保存的分頁草稿為基準；關閉無提示，後續新修改需確認；放棄保留原草稿 |
| 登出 | 保留原登出確認；未保存時再確認，選繼續不發送logout POST；登出失敗仍保留內容與保護 |
| 刷新／關閉分頁 | 使用原生beforeunload；取消刷新保留輸入。文字由瀏覽器决定，提示受使用者互動及瀏覽器政策限制 |
| 手機側欄跳頁 | 先關閉抽屜及解除主內容inert，再顯示確認；取消後仍可操作表單 |
| 未修改內容 | 正常跳頁、關閉及深層路由刷新，不增加提示 |

B/C草稿仍是sessionStorage，限定目前分頁、原使用者／單號／狀態／revision及24小時效期。不是伺服器或跨裝置保存。使用者放棄時，既有草稿與伺服器記錄保持其已保存內容。

## 側欄權限規則

依現行頁面與API讀取權限顯示；隱藏的群組不占空列，可見項目保留來源順序及尺寸。規格見 [SIDEBAR_LAYOUT_SPEC](SIDEBAR_LAYOUT_SPEC.md)。

| 入口 | 所需權限 |
| --- | --- |
| A/D/E新增 | Lending_form／Room_form／Equipment_form.create；可建立但不可讀的草稿角色保留 |
| A/D/E查詢 | 對應表單read，與/api/bookings一致 |
| 借用紀錄／車輛歷史 | 任一A/D/E read／A read |
| 出回程紀錄 | Departure_query.read且departure_form或back_form.read；只有C可讀連到/stages?kind=C |
| 即時車輛／軌跡 | CarUpdate.read／CarUpdate.read且carMap.read |
| 設備位置／場內資訊 | FindMy.read／Latest_Device.read |
| Beacon／CarList／EquipmentList | BeaconList／VehicleManagement／EquipmentManagement.read |
| 通知／封存 | Administration.read；封存另須既有enabled條件 |
| 資產巢狀清單／新增 | 對應資產read／read且create，符合現行資產頁Guard |

直接URL與API的既有Guard、政策、欄位read/write、owner及revision規則保留。側欄隱藏不能取代後端授權。

## 驗證

- `npm run build`：通過。產物`index-CJZnN7aK.js`、`index-bRPEt-df.css`。
- `npm run test:navigation`：10組通過，瀏覽器pageerror為0；結果見 [results.json](screenshots/navigation/results.json)。
- `npm run test:api`：14項通過，涵蓋權限、owner、欄位規則、revision、保存回讀及流程。
- `npm run test:forms`（本次直接執行`node tests/forms.mjs`）：6組通過，涵蓋A七種需求、E七類正常保存與編輯、D多區及衝突、B/C四階段草稿、四種照片預覽／回填／取消移除／保存移除及欄位權限；結果見 [forms-results.json](screenshots/navigation/forms-results.json)。
- `npm run test:calendar`：8組通過，最終版本四視圖／代表寬度／保存回讀／深層路由及手機回歸；結果見 [calendar-results.json](screenshots/navigation/calendar-results.json)。
- `npm run test:sidebar`：6組通過，最終版本順序／巢狀捲動／路由／唯讀／手機焦點及空／錯誤狀態；結果見 [sidebar-results.json](screenshots/navigation/sidebar-results.json)。
- `git diff --check`：通過。

navigation專項在18028以一次性SQLite及附件目錄執行，AMS_DATA_DIR及PREVIEW_DATA_DIR均明確覆寫，測後回收。成功保存、B階段修訂及C照片上傳使用真實隔離API；失敗保存／登出、上傳延遲及部分auth/me權限用瀏覽器fixture。後端政策由test:api驗證；部分權限截圖中的資料是管理員API資料，不能當作該權限政策的伺服器資料隔離證明。

Chromium實際觸發並取消beforeunload刷新，確認原輸入保留；未修改深層路由可刷新。此結果不承諾所有瀏覽器或手機關閉應用程式時一定顯示提示。

## 截圖

| 畫面 | 交付證據 |
| --- | --- |
| 1440×1000桌面離頁確認 | [desktop-leave-confirmation](screenshots/navigation/desktop-leave-confirmation.png) |
| 390×844手機離頁確認 | [mobile-leave-confirmation](screenshots/navigation/mobile-leave-confirmation.png) |
| B草稿後新修改關閉確認 | [stage-draft-leave-confirmation](screenshots/navigation/stage-draft-leave-confirmation.png) |
| 部分read與create權限側欄 | [partial-permission-sidebar](screenshots/navigation/partial-permission-sidebar.png) |
| 零權限無空群組 | [no-permission-sidebar](screenshots/navigation/no-permission-sidebar.png) |

桌面與手機確認窗未出現橫向溢出；共同浮層使用aria-labelledby連接標題，預設焦點為「繼續編輯」。未新增素材、Form.io執行依賴或完整Schema renderer。

## 預覽與交付邊界

可操作預覽：[18024示範入口](http://163.18.26.228:18024/)。示範登入後可在任何借用新增表單輸入，再點日曆，測試繼續與放棄。啟動及正式發版補充見 [MAIN_SCREEN_PREVIEW](../../deploy/MAIN_SCREEN_PREVIEW.md)。本批本機health回`mode:preview`、`database:sqlite`、`test_data:true`；首頁、E新增及stages深層網址回200並提供上述最新JS。

此批無後端／SQL／資料格式變更、無新套件，未重啟5173／5174或寫入正式資料。正式SSO、PostgreSQL及公司實際政策仍須按原部署文件驗收；來源品牌／profile素材及原站最終字體、边距、逐像素比對維持既有未確認標記。
