# 主畫面側邊欄獨立布局規格

更新：2026-10-10。使用者要求接續修改主畫面側邊欄。本文件取代初批主畫面保留平鋪選單的規則；日曆與表單布局仍依各自規格。

證據標記沿用 [LAYOUT_SPEC](LAYOUT_SPEC.md)：S＝來源靜態確認、R＝保留本專案可用契約、I＝本次明確實作規則、V＝隔離瀏覽器驗證、U＝尚缺正式來源畫面。來源為專案內 [FUNCTIONAL_SPEC](source/FUNCTIONAL_SPEC.md) 第2章導覽順序、第16章固定／捲動規則及V-0001～V-0012；原側欄與子項程式僅供研究。交付不需要原專案、原圖或遠端renderer。

## 固定區與捲動區

從上至下：手機關閉列 → 品牌圖片槽 → 使用者區 → 可捲動導覽 → 料件管理 → 登出。桌面沒有手機關閉列。S。

| 區塊 | 桌面 | ≤768px | 證據 |
| --- | --- | --- | --- |
| 側欄 | 固定左邊、250px寬、100dvh高 | 左抽屜280px寬、100dvh高 | S/I |
| 關閉列 | 不顯示 | 50px高、8px內距，關閉鈕右對齊，34×34px | S/I |
| 品牌槽 | 80px高，220×55.1px文字／圖片槽 | 60px高，160×40.1px槽 | S/I |
| 使用者區 | 外距上下左右8px，高140px | 相同 | S/I |
| 使用者區寬 | 側欄內寬減16px | 相同 | I：來源width100%加外距會越界，保留外距與比例並收回邊界 |
| 背景／頭像 | 上半70px；背景cover，40×40頭像在區塊left15/top45 | 相同 | S |
| 使用者文字 | 背景標題12px、姓名12px粗體，姓名置中、距底10px；tooltip保留姓名/email/ID | 相同 | S/R |
| 中間選單 | 占剩餘高度，min-height0，上距4px，獨立縱捲，禁止橫向溢出 | 相同 | S/I |
| 固定底部 | 料件列內距16px、下距0；登出列上距8／左右底16px | 料件內距8px；登出上距4／左右底8px | S |
| 底部按鈕 | 滿寬、至少42px高、14px字、4px圓角 | 至少32px高、12px字 | S/I |

側欄本身overflow:hidden；品牌、使用者、底部flex-shrink:0。只有`.sidebar-menu`可捲；展開再多資產也不把底部推離視窗。桌面收合完全移走側欄，主內容占滿；手機不占主內容寬度，有左抽屜遮罩。R/V。

2026-10-12品牌槽使用使用者提供的 `public/Logo.jpg`（236×100），`img`的alt為「台灣波力梅 TAIWAN POLIMAX」。維持桌面220×55.1／手機160×40.1框，移除虛線邊框；object-fit:cover及置中只裁去素材上下白邊，Logo字樣完整。profile背景與頭像沿用既有data-asset-slot。

## 選單列與展開

全部主要列按來源順序排列，初始群組收合，沒有「工作空間／資產管理／定位與資訊」額外段標題。點擊群組只在該列下方插入子項，後續群組下移；再點移除子項。各同層群組獨立；巢狀公務車與儀器設備可同時展開。外層收合會卸載子項，重新展開後巢狀群組重回收合，符合來源元件生命週期。S。

每列滿寬、至少48px高；字16px／行24px；內距上下8、左右16px。主要列圖示24×24、圖示欄56px；文字起點72px。群組箭頭24×24靠右，展開向上、收合向下。子項文字左縮排80px，巢狀新增左96px，藍色#1976d2粗體。動態車牌／設備名稱依原程式從左16px起，不自動加父群組縮排。長名稱可換行加高，保留順序與操作。S/I。

背景#f8f9fa、文字#374957、hover#edf0f2、目前入口#e1e8ec；底部白底，料件藍色outline、登出紅色outline。焦點以2px藍框顯示。圖示使用現行lucide向量替代，保持相同位置與操作意義。S/I。

| 順序／群組 | 子項（由上至下） | 現行入口 |
| --- | --- | --- |
| 1 日曆 | 單一葉項 | `/` |
| 2 借用申請 | 車輛借用新增、作業區借用新增、儀器借用新增 | `/bookings/new/A`、`/bookings/new/D`、`/bookings/new/E` |
| 3 借用中 | 車輛使用查詢、作業區使用查詢 | `/bookings?kind=A`、`/bookings?kind=D` |
| 3 的現行補充 | 儀器使用查詢、發車紀錄查詢、還車紀錄查詢 | `/bookings?kind=E`、`/stages?kind=B`、`/stages?kind=C` |
| 4 公務車使用管理 | 車輛即時資訊查詢、車輛使用歷史紀錄、車輛行駛軌跡查詢 | `/positions`、`/bookings?history=1`、`/positions?view=history` |
| 5 設備管理 | 設備即時位置、設備場內資訊 | `/findmy`、`/scans` |
| 6 後台資訊管理 | BeaconList、CarList、EquipmentList | `/beacons`、`/vehicles`、`/equipment` |
| 7 資產設備資訊\|管理 | 公務車 → 新增車輛資料、有效車牌；儀器設備 → 新增儀器設備資料、設備名稱 | `/vehicles?create=1`、`/vehicles/:id`；`/equipment?create=1`、`/equipment/:id` |

原群組與標籤S，具體URL和補充入口R；不恢復舊站只有`/`與刷新回日曆的限制。2026-10-12依使用者要求移除重複的「借用紀錄／出回程紀錄」側欄項目，既有 `/bookings`、`/stages` 直達路由仍保留。A/D/E入口固定查詢對應類型，使用相同API與資料篩選；E依新要求沿用D表格，詳見 [QUERY_LAYOUT_SPEC](QUERY_LAYOUT_SPEC.md)。即時／軌跡入口使用同一定位頁的不同初始模式，切換URL或重新整理皆正確帶入；不新增地圖業務功能。資產新增入口開啟既有編輯浮層，取消清除create參數，後續可再次開啟。R/V。

同日後續要求：「資料來源與通知／歷史封存」不在本次製作範圍，移除後台資訊管理中的兩個入口。該群組僅由BeaconList／VehicleManagement／EquipmentManagement的read決定是否顯示，無可讀子項就不顯示空群組。主畫面不再為側欄請求 `/api/archive/status`；原有資料與其他功能不變。

本次 `npm run build` 通過；隔離預覽確認管理員與唯讀使用者僅見後台三項，只有Administration.read的UI權限fixture不顯示空群組。390px手機不顯示移除項目，CarList直達刷新正常，無archive/status請求與瀏覽器pageerror。結果與截圖：[驗證紀錄](screenshots/sidebar-admin-scope-2026-10-12/verification.json)、[桌面](screenshots/sidebar-admin-scope-2026-10-12/desktop.png)、[手機](screenshots/sidebar-admin-scope-2026-10-12/mobile.png)。驗證只讀既有示範資料，不更動借用紀錄；既有服務重建dist後重新整理即可。

## 資料、權限與狀態

- 車輛／設備清單沿用`/api/resources`及共同查詢快取，依API原順序；車輛顯示label、設備優先name。排除isdelete數字1／字串"1"，亦兼容data.isdelete。沒有把選單重新排序。S/R。
- 清單首次可用資料尚未到達顯示「載入中…」，無資料顯示「無車輛資料／無設備資料」，API失敗顯示「清單載入失敗」及重試；不將失敗當空資料。I/V。
- A/D/E新增依既有對應表單create權限；無可建立種類就不顯示借用申請群組。資產新增依VehicleManagement／EquipmentManagement的create，資產清單依read。URL直接輸入create=1仍檢查create，不能藉側欄繞過。R/V。
- 查詢入口依頁面與API現行read權限隱藏，無可見子項的群組不顯示；可見項目仍依上表順序。頁面Guard、後端權限及封存啟用條件保留，不以側欄隱藏取代直接URL或API檢查。R/I。
- A/D/E查詢使用Lending_form／Room_form／Equipment_form的read，與現行`/api/bookings`一致；不以舊Submission_query／Room_query替代。車輛歷史需A可讀。發車／還車紀錄查詢需Departure_query及各自departure_form／back_form的read；只有C可讀時只顯示還車查詢，連到`/stages?kind=C`。R/I。
- 即時車輛需CarUpdate的read，軌跡還需carMap的read；設備位置／場內資訊分別需FindMy／Latest_Device的read。Beacon、車輛、設備分別依BeaconList、VehicleManagement、EquipmentManagement；Administration不再產生側欄項目。資產新增需相應read及create，與現行資產頁入口一致；借用新增仍可create但不可read，以保留草稿角色。R/I。
- 完整刷新保留目前URL，群組回到初始收合；不宣稱保存使用者的群組展開偏好。桌面整體收合與手機抽屜為分開狀態，跨768px斷點關閉手機抽屜。R/I/V。
- 手機開啟焦點移到關閉鈕，主內容inert，Tab／Shift+Tab留在抽屜；Esc、遮罩、關閉鈕及葉項導覽可關閉，回開啟控制；群組開關本身不關閉抽屜。隱藏側欄inert，鍵盤不會進入畫面外選單。I/V。

底部料件管理沿用來源公開連結`https://materials.54ucl.com`，新分頁並加noopener noreferrer；頁面載入不呼叫外部服務。登出沿用現行確認浮層及`/api/auth/logout`，取消不登出。此批沒有使用來源中的token輸出、localStorage.clear或直接呼叫舊IDP。S/R。

表單尚未保存時，側欄跳頁及确认登出會顯示離頁確認；手機先關閉抽屜再顯示，選「繼續編輯」保留原路由及內容。規則與驗證見 [NAVIGATION_SAFETY_ACCEPTANCE](NAVIGATION_SAFETY_ACCEPTANCE.md)。I/V。

## 未確認項目

- 原站正式截圖與CSS最終疊加仍U；本批V只涵蓋交付版的尺寸、比例與互動，沒有原站逐像素比對。
- 品牌圖片已由使用者提供並套用，profile背景與頭像仍預留；正式料件外部站與SSO實際登出未連線驗收。連結來自靜態來源，不代表確認當下可連入。
- 清單壓力、刪除旗標、空／錯誤狀態測試使用瀏覽器匿名fixture；真實正式資料與政策保持既有驗收邊界。

畫面與命令結果見 [SIDEBAR_ACCEPTANCE](SIDEBAR_ACCEPTANCE.md)；預覽／部署沿用 [MAIN_SCREEN_PREVIEW](../../deploy/MAIN_SCREEN_PREVIEW.md)。
