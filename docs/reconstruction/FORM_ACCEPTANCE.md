# ABCDE 表單重建交付與隔離驗收

日期：2026-10-10。先完成主畫面後，依使用者接續指示重建表單。需求依 [交接文件](../../CODEX_XHIGH_HANDOFF.md)，獨立布局依 [FORM_LAYOUT_SPEC](FORM_LAYOUT_SPEC.md)。本紀錄區分交付版驗證與原站／正式環境，未宣稱逐像素相同。

後續使用者修正：A車輛與E儀器新增／編輯表單移除「申請緣由」，因原表沒有此欄。以下是初批畫面及驗證紀錄；最新欄位、截圖與保存相容規則見 [FORM_FIELD_CORRECTION](FORM_FIELD_CORRECTION.md)。

## 可操作成果

隔離預覽：`http://163.18.26.228:18025/`（本機`http://localhost:18025/`）。已啟動`npm run preview:forms`，health為`mode=preview, database=sqlite, test_data=true`；選示範管理員登入。外部網路能否連入仍取決於主機網路設定。

直接入口：A `/bookings/new/A`、D `/bookings/new/D`、E `/bookings/new/E`。B/C從保存後A詳情依序填發車、發車抵達、還車、還車抵達；階段详情可修訂。預覽使用`.preview/borrowing-forms`；沒有重啟或切換正式5173/5174服務。啟動、操作與正式部署補充見 [FORMS_PREVIEW](../../deploy/FORMS_PREVIEW.md)。

本批完成：

- A同頁panel、七種條件明細、時段表、原四列五欄用途清單，增／改／保存／取消／刪除及日曆帶值。
- B/C出發與抵達的基本資料、原檢查表格格位、正常／異狀、里程、途中異常及分頁草稿。
- C內部、外部異狀、設備異狀與停放地四類照片，上傳、縮圖、預覽、重開回填及移除；上傳未完成不可提交。
- D時間、樓層、條件區域／編號、多區保存、修改與衝突驗證；選區域不丟掉已輸入時間。
- E三panel、七種類別明細、設備／編碼／位置、人員與時段；正常新增、重讀與修改；無車輛流程。

## 畫面證據

全部為自行實作版及匿名測試資料，未使用原站renderer。桌面A/D/E為1440px；手機390px；B/C桌面用1440×1600顯示更多長表單，仍保留浮層內捲。手機表格橫捲保留欄順序，畫面截圖可能只顯示部分欄。

| 畫面 | 桌面 | 手機／補圖 |
| --- | --- | --- |
| A | [A-desktop.png](screenshots/forms/A-desktop.png) | [A-mobile.png](screenshots/forms/A-mobile.png) |
| B出發 | [stage-0-desktop.png](screenshots/forms/stage-0-desktop.png) | 手機實際借還流程見browser回歸 |
| B抵達 | [stage-1-desktop.png](screenshots/forms/stage-1-desktop.png) | 同上 |
| C出發／照片 | [stage-2-desktop.png](screenshots/forms/stage-2-desktop.png) | [C-mobile.png](screenshots/forms/C-mobile.png)、[桌面下半部](screenshots/forms/C-desktop-bottom.png) |
| C抵達 | [stage-3-desktop.png](screenshots/forms/stage-3-desktop.png) | 手機實際借還流程見browser回歸 |
| D | [D-desktop.png](screenshots/forms/D-desktop.png) | [D-mobile.png](screenshots/forms/D-mobile.png) |
| E | [E-desktop.png](screenshots/forms/E-desktop.png) | [E-mobile.png](screenshots/forms/E-mobile.png) |

## 執行結果

測試各自使用一次性資料，結束刪除；桌面瀏覽器時區America/Los_Angeles，輸入／顯示及API時段保持Asia/Taipei。

| 命令 | 結果與證據 |
| --- | --- |
| `npm run check` | TypeScript通過 |
| `npm run build` | 通過；最終前端資產`index-Vf9WX7es.js`、`index-CUn1pdsL.css` |
| `npm run test:forms` | A七需求、E七類別皆成功保存／回讀；明細CRUD／取消、时段驗證、條件草稿、D多區／衝突、B/C四次流程與四类照片、欄位唯讀／隱藏；[結果JSON](screenshots/forms/results.json) |
| `npm run test:browser` | 桌面完整A/B/C、秒數／時區、階段修訂、其他模組導航及手機唯讀使用者通過 |
| `AMS_TEST_MOBILE=1 … npm run test:browser` | 390px觸控完整A/B/C與階段修訂通過；A/D/E無建立權限均無表單 |
| `npm run test:calendar` | 8組通過；四視圖、車牌／日期、A新增帶值、A/D/E事件、側欄／刷新及权限均正常 |
| `npm run test:api` | 14案例通過；保存／衝突／并行、revision、流程、照片、D/E、遞迴欄位權限與有效detail_index |
| `test_form_compatibility.py` | 2案例通過；A舊JSON的組長／業務、成交案回訪名称、用途及其他加工說明往返；E七類canonical保存往返 |
| `test_manual_people.py` | 1案例通過，手填人員不依賴舊員工服務 |
| `test_departure_access.py` | 9案例通過；既有API路由配匿名mock repository，申請人／owner及代填限制 |
| `test_standalone.py` | 4案例通過，獨立設定／部署與權限快照契約 |
| `git diff --check` | 通過 |

A布局量測寬度1440、900、769、768、481、480、390，頁面橫溢出均0；各panel在主內容內，時段欄寬實測符合2:2:3:3:2。A/D/E及B/C截图擷取時亦檢查頁面橫溢出為0。照片測試保存後再次GET各檔案預覽為200，再進入修訂可見四筆引用；取消移除不改伺服器資料，保存移除清空最新内圖引用且不倒退父流程。欄位UI測試使用`/auth/me`匿名回應覆寫模擬唯讀／隱藏；伺服器權限另由API與owner測試核對。

## 修改檔案與保存相容

前端：新增`BorrowingForms.tsx`、`FormLayout.tsx`、`StageFields.tsx`、`forms.css`；Bookings保留查詢與詳情，改表單出口；Stages保留advance與修訂介面，接新布局及草稿；ui加照片縮圖及上傳狀態；main載入表單CSS。照片按本地引用移除，沒有新增物理刪檔動作。

後端：`legacy_store.py`／`legacy_form_fields.json`補A原欄位編解碼；新增`form_validation.py`供正式與demo共用明細對應驗證；沒有新SQL表或變更owner／權限判斷。E沿用可用canonical保存契約，排除來源拒用／500缺陷。

測試與文件：新增forms專項瀏覽器／相容測試、18025預覽腳本；更新browser/calendar對五步畫面的舊selector；API測試明確設定兩個隔離資料路徑；更新README、PROJECT_SPEC、ACCEPTANCE、實作計畫及來源清單。

## 差異與限制

- 原站正式畫面、最後CSS疊加、遠端選項及SSO尚未重新實測；靜態來源與重建瀏覽器結果分開標記。
- D來源重複編號與正式API「拆組裝整區」差異，依現有資源保留，沒有創建正式資產。
- 初批曾加上申請緣由，後續已依使用者指示移除A/E的畫面欄位，內部title仍與現行API相容；手動人員、E正常時段與備註、C異狀文字、抵達附件保留既有可用契約。
- 草稿保存於本瀏覽器分頁、24小時有效，沒有跨裝置伺服器草稿。原圖未交付的位置仍按主畫面素材槽保留。
- 相容層測試使用匿名fixture／mock，不等同在真實PostgreSQL、正式舊表單與附件逐筆驗收。正式套用Python更新、SSO及真實資料驗收仍依部署文件執行。
