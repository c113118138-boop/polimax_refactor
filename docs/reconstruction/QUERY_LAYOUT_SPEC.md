# 車輛、作業區與儀器使用查詢布局規格

日期：2026-10-10。使用者接續授權將兩個查詢頁改成來源排列。本文件可獨立用來重建畫面，不需要原站、完整Schema或原始專案才能實作。需求優先序仍依 [CODEX_XHIGH_HANDOFF](../../CODEX_XHIGH_HANDOFF.md)。

## 證據與適用範圍

- S（靜態來源確認）：來源頁 `Submission_query.jsx`、`Room_query.jsx`；專案內快照 [FUNCTIONAL_SPEC](source/FUNCTIONAL_SPEC.md) 的 P-0010、P-0013 及末段表格布局記錄。確認欄位順序、區塊排列、20px外距、表格框線／最小欄寬及多列合併。
- V（本專案瀏覽器驗證）：相對位置、控制連動、資料與操作、代表寬度；結果見 [QUERY_ACCEPTANCE](QUERY_ACCEPTANCE.md)。這些是重建畫面證據，不是原站截圖。
- R（保留現行功能）：正常路由／刷新、自行實作的表單、權限及owner限制、E／歷史查詢、API保存、台北時區、錯誤處理。
- U（缺證據）：未取得原站實際畫面、最後CSS疊加、正式字體及圖示原檔；不能宣稱逐像素一致。標題24px粗體、Arial／Noto Sans TC fallback、查詢內容白底及窄画面折行是本次明確的本機規則。

`/bookings?kind=A`、`/bookings?kind=D` 使用來源布局；2026-10-12使用者追加要求讓 `/bookings?kind=E` 沿用D的表格外框與操作排列，移除分類tabs。E查詢布局是使用者指定的延伸，不宣稱有原站同頁證據。全部預約的既有直達路由保留；2026-10-11後續授權的歷史11欄与自製彈窗依 [SITE_PARITY_LAYOUT_SPEC](SITE_PARITY_LAYOUT_SPEC.md)。車輛使用紀錄入口仍為 `kind=A&resource=ID`，设备使用紀錄仍用 `kind=E&resource=ID`；A/D/E不放統計卡或分類tabs。

## 共用外框與表格

保留既有側欄／上方導覽；查詢內容占滿可用主內容寬度，四邊padding20px，不再疊加通用main的34px padding及1800px上限。這個覆寫只作用於查詢內容，不影響日曆與表單。

內容順序為標題列 → 車輛來源提示（條件）→ 車輛篩選卡（A專用）→ 錯誤／載入狀態 → 表格。頁面隨文件縱向捲動；表格容器獨立橫向捲動，可鍵盤聚焦，不改成卡片。

標題列flex，align-items:center，gap12px，可折行；標題h2 margin0、24px／700／line-height1.3。A標題列margin-bottom20px；D/E為10px。「新增」緊接D/E標題右邊，藍底#007bff、白字14px、padding6px10px、radius4px，沒有右側滿欄推齊。

表格width100%、border-collapse:collapse、14px。所有th／td border1px solid #ccc、padding6px8px、min-width120px、white-space:pre-wrap、word-break:break-word、垂直置中、靠左。A操作欄容納四個不折行圖示與內距，實測約132px；D/E操作欄同其他欄至少120px。A/D/E表頭均為#f0f0f0；th粗體，文字#212529。D來源表頭為白色，依2026-10-12使用者要求改為與A相同的灰底。A hover#f8f9fa，D/E hover#fff8f0。合併格的邊框仍保持完整，包含最後一列，不沿用通用列表無框線樣式。

每筆申請依API時段順序展開，一個時段一列。同表單的列連續排列；篩選後只合併實際留下的列，不用原始列數作rowSpan。API沒有時段的既有紀錄仍保留一列，避免消失。

## A：車輛使用查詢

標題預設「借用紀錄表（共 N 筆）」；N為符合條件的**不同表單數**。N與未篩選總表單數M不同時加「 / 總共 M 筆」。不把時段列數當申請數。

表格欄位從左到右：

| 欄 | 顯示與合併 |
| --- | --- |
| 表單編號 | id；同單rowSpan，保留可直達詳情的文字連結 |
| 車牌 | 每時段resource_id對應的資源label；找不到現行資源時先讀保存的resource_snapshots，仍缺則顯示資源編號 |
| 申請緣由 | 已保存的需求類別reason，例如工案／材料送貨。不是額外title輸入，不能加回已移除欄位 |
| 地點 | 該時段detail_index對應明細的縣市＋行政區，缺值時使用既有地點資料 |
| 開始時間 | 該時段start；台北時間完整YYYY-MM-DD HH:mm:ss |
| 結束時間 | 該時段end；同上 |
| 業務人員 | 明細sales，缺值才用既有employees；多人以逗號分隔 |
| 申請人 | content.applicant |
| 狀態 | 同單rowSpan；來源名稱與色彩見下表 |
| 申請時間 | created_at；台北時間完整秒數 |
| 操作 | 同單rowSpan；左到右編輯、刪除、下一階段、軌跡，依權限／狀態省略 |

舊API的title可能是車牌，現行title是申請標題；本次必須取資源label，不能把申請標題誤放車牌欄。明細關聯優先使用已保存slot.detail_index，舊資料缺值時依序使用對應／最後一筆明細。

### 篩選卡

卡片#f8f9fa，border1px#e9ecef，radius8px，padding16px，margin-bottom20px。第一行：24px篩選圖示＋粗體「篩選條件」，gap8px、margin-bottom8px；圖示#6c757d、文字#495057。

第二行flex、align-center、gap12px、可換行，順序固定：

1. 篩選類別select：全部顯示／依開始時間／依結束時間／依申請時間／依車牌／依申請緣由／依地點／依業務人員／依申請人／依狀態。
2. 五個狀態快選（選「依狀態」時隱藏）。快選群組gap8px、可折行，各button24px高、13px字、左右8px padding、radius16px；選中為#1976d2白字。點快選會改為全部顯示類別並套狀態。
3. 動態輸入：日期類別顯示開始日期／「至」／結束日期；需求類別顯示全部類型＋七種需求select；狀態類別顯示全部狀態＋五種狀態select；車牌／地點／業務人員／申請人顯示200px寬搜尋input；全部顯示沒有額外input。
4. 有作用中的類別或狀態時顯示灰底白字「清除」，含16px X圖示、padding6px8px、radius4px。清除恢復全部顯示／全部狀態並清空日期、文字及需求。

input／select為14px、35px高、padding6px8px、border1px#ccc、radius4px、白底。日期群組gap8px；在窄畫面可折行，不擠出頁面。

作用中的篩選卡底部顯示12px提示、margin-top8px：找到N筆符合條件的記錄及所選狀態；無結果為紅色#dc3545。文字不分大小寫、逐時段匹配；需求「其他」涵蓋不屬前六種的舊需求資料。日期以台北日期比對、含結束日全日；不恢復來源將結束日當午夜而漏掉資料的缺陷。

| 狀態 | 顯示名稱 | 前景／背景 |
| --- | --- | --- |
| PENDING | 預約單已提交 | #0288d1／#e1f5fe |
| DEPARTURE | 發車單已提交 | #2e7d32／#e8f5e9 |
| DEPARTURE_ARRIVED | 發車已抵達 | #ed6c02／#fff3e0 |
| RETURN | 還車單已提交 | #9c27b0／#f3e5f5 |
| RETURN_ARRIVED | 已完成 | #1976d2／#e3f2fd |

操作圖示22px；外框24×28px、inline-flex、gap6px、無背景與框線。編輯#007bff、刪除red、下一階段#17a2b8、軌跡#28a745。A僅PENDING可編輯；下一階段重用B/C表單，開啟前讀取最新revision。完成單沒有下一階段。發車及發車抵達依既有owner／代填規則限制。軌跡帶首筆顯示時段的資源與起訖至既有位置頁，且需要CarUpdate及carMap read；同單多列操作仍只顯示一次。

### 從車輛管理進入

`resource=ID` 只留下該車時段。標題左邊灰底「返回車輛管理」連到該資產詳情；標題改為「車輛使用紀錄 - 車牌 （共 N 筆…）」。下方提示卡#e3f2fd、border1px#2196f3、radius8px、padding12px16px、margin-bottom16px、gap8px；24px車輛圖示＋「正在顯示車牌『車牌』的使用紀錄」，字#1976d2。保留URL篩選，卡內清除不移除來源資源條件。

## D：作業區使用查詢

標題「作業區預約紀錄（共 N 筆）」；N為**展開後時段列數**，沿用來源計數。標題右邊「新增」依Room_form create顯示並直達D表。標題下直接接表格，沒有篩選卡、狀態快選、分類tabs、介绍文案。

表格從左到右：表單編號、申請原因、使用空間、開始時間、結束時間、申請人、建立時間、操作。表單編號與操作合併，其餘每時段一格。申請原因取reason，使用空間取該時段作業區label；三個時間皆使用完整台北日期及秒數。操作依序查看（深色）、編輯（藍）、刪除（紅），間距及圖示尺寸同A。

2026-10-11接續改為來源尺寸的自製查看／編輯浮層。正常點擊在原查詢位置開啟，保存後回原表格；原深層詳情／表單href保留，可直接刷新或另開分頁。浮層使用自行實作的React欄位，沒有Form.io。

## E：2026-10-12使用者指定的儀器表格

標題「儀器借用紀錄（共 N 筆）」；N與D一致，計算展開後的時段列數。有`resource=ID`時僅顯示該設備的時段。標題右側「新增」依Equipment_form.create顯示，連到 `/bookings/new/E`；下方直接接表格，移除「全部預約／車輛借用／作業區／儀器借用」分類列與通用車牌、緣由篩選列。

由左到右十欄：表單編號、借用類別、儀器設備、開始時間、結束時間、使用人員、申請人、狀態、建立時間、操作。類別取既有reason；設備優先name，編碼label另起一行12px灰字；現行資源缺失時使用保存的resource_snapshots，再缺則顯示資源編號。使用人員取employees，多人以逗號分隔，不誤用業務人員。保留既有狀態資訊；開始、結束及建立時間均顯示完整台北日期與秒數。同單的編號、狀態與操作合併，其餘每時段一列。

操作與D一致：查看、編輯、刪除；查看／編輯沿用自製浮層與離頁保護，保存後回原表格。正常href仍可另開分頁與直接刷新。read、write、delete、owner_only及detail_allowed限制皆依Equipment_form，不新增車輛B/C流程。空資料跨十欄；手機沿用表內橫捲，不改卡片。

## 狀態、權限與窄畫面

- 載入中在表格位置顯示現有Loading；API載入失敗顯示ErrorBox及重試，不能假裝空資料。資源失敗保留錯誤及snapshot／資源編號fallback。
- 空資料與無結果都放在表內跨11／8／10欄的格子，padding20px、置中、#666；顯示「暫無資料」或「沒有符合篩選條件的資料」。D原始頁沒有清楚空態，本次補足以保留可用性。
- 查詢頁read以Lending_form／Room_form／Equipment_form Guard驗證；刪除／編輯按各表單權限及owner_only顯示，後端仍為最終權限檢查。detail_allowed=false的摘要不提供詳情連結與操作，不補出被遮罩內容。
- 刪除重用現有確認框；取消不刪除、API失敗保留紀錄並顯示錯誤、成功重新讀取清單。B/C重用現有未保存關閉保護、檢查與保存功能。
- 1440／900／769／768／390 CSS px都維持20px內容padding與欄位順序；共用側欄768px斷點仍遵循側欄規格。查詢頁不用另一個斷點改卡片；表格不足就橫捲，篩選與標題自然折行，整頁不能橫向溢出。
- 本頁沒有來源圖片區，不新增裝飾圖片；圖示使用現有lucide，可替换圖檔但維持22～24px位置與比例。缺少原圖不改布局。

程式為 `src/BookingQueries.tsx`、`src/queries.css`；`Bookings.tsx`分派A/D/E路由；全部預約的直達入口繼續原元件。側欄依同日要求移除重複的「借用紀錄／出回程紀錄」，保留各類查詢入口及舊路由。沒有新增套件、後端欄位、SQL migration、Form.io renderer或完整Schema依賴。
