# 接手所需檔案與證據邊界

2026-10-12單檔交付：左上角已使用 `public/Logo.jpg`。最新已確認版本的獨立重建文件為 [POLIMAX_REBUILD_SPEC.md](../../POLIMAX_REBUILD_SPEC.md)，內嵌完整自行實作程式、Logo、套件鎖、schema-only SQL及還原程式；無須再取得本目錄的歷史來源快照。Logo五種宽度驗證與桌面／手機截圖位於 `screenshots/logo-2026-10-12`，單檔還原驗證見 [spec-restoration-verification.json](spec-restoration-verification.json)。

2026-10-11新範圍：原站其餘可見頁面布局見 [SITE_PARITY_LAYOUT_SPEC](SITE_PARITY_LAYOUT_SPEC.md)，對照計畫見 [SITE_PARITY_PLAN](SITE_PARITY_PLAN.md)，驗證／截圖見 [SITE_PARITY_ACCEPTANCE](SITE_PARITY_ACCEPTANCE.md)，部署見 [SITE_PARITY_PREVIEW](../../deploy/SITE_PARITY_PREVIEW.md)。`SITE_PARITY_SOURCES.json`記錄本輪原 JSX／API靜態研究檔案与SHA-256，不是原站執行截圖。原始快照保留，使用者新授權範圍優先於下方最初批次說明。

日期：2026-10-10。相對路徑以本文件所在目錄為準，程式清單則以專案根目錄為準。來源快照識別／SHA-256 見同目錄 `SOURCE_SNAPSHOT.json`。

2026-10-12接續修訂：D灰色表頭、移除兩個重複側欄入口、E沿用D表格與移除分類列；使用者指定的E延伸布局及本輪驗證／截圖見 [EQUIPMENT_QUERY_UPDATE](EQUIPMENT_QUERY_UPDATE.md)。

## 1. 先交給下一個 Codex 的文件

| 檔案 | 用途與限制 |
| --- | --- |
| [CODEX_XHIGH_HANDOFF.md](../../CODEX_XHIGH_HANDOFF.md) | 使用者已確認要求、修訂優先序、範圍、驗收及直接執行指令；第一個閱讀 |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | 六段順序、16–26小時估時、每段可檢視成果與驗證 |
| [source/FUNCTIONAL_SPEC.md](source/FUNCTIONAL_SPEC.md) | `/home/c113118138/FUNCTIONAL_SPEC.md` 原樣快照，約69,589行；含歷史缺陷與重複驗收，不能全部當作甲方需求 |
| [未確認事項（來源主規格末節）](source/FUNCTIONAL_SPEC.md#獨立重建時的未確認邊界) | 13項未確認事項已完整收錄於FUNCTIONAL_SPEC；2026-10-12清理刪除重複的SPEC_UNCONFIRMED.md。來源主規格與SOURCE_SNAPSHOT.json保留歷史原文／識別，原文提及獨立清單時改讀本節 |
| [reference-style-probe.png](reference-style-probe.png) | 使用者表示「看起來不錯」的基礎樣式試看圖；手寫HTML＋本機研究用CSS，沒有Schema／renderer；不是ABCDE原頁布局證據 |
| [README.md](../../README.md)、[PROJECT_SPEC.md](../../PROJECT_SPEC.md)、[PROJECT_SPEC_view.md](../../PROJECT_SPEC_view.md) | 現行架構、路由、API、資料及部署入口；舊設計敘述需和新要求核對 |
| [ACCEPTANCE.md](../../ACCEPTANCE.md)、[SPEC_COMPARISON.md](../../SPEC_COMPARISON.md) | 既有驗收／對照；「不要求原UI像素與圖示」按使用者素材佔位補充解釋 |
| [deploy/README.md](../../deploy/README.md)、[deploy/STANDALONE.md](../../deploy/STANDALONE.md) | 正式PostgreSQL／PostGIS、SSO、資料／附件及搬機需求；不得當成本次已重新驗收 |

來源規格首頁提及 `SPEC_TRACEABILITY.md`，目前尚未找到可讀檔案；不能假定它已交付或靠它補齊缺失內容。重要證據位置應直接補進本專案布局規格。

## 2. 來源規格閱讀定位

接續查詢頁的獨立重建規則見 [QUERY_LAYOUT_SPEC](QUERY_LAYOUT_SPEC.md)、畫面與測試見 [QUERY_ACCEPTANCE](QUERY_ACCEPTANCE.md)、部署見 [QUERIES_PREVIEW](../../deploy/QUERIES_PREVIEW.md)。研究對象是`Submission_query.jsx`／`Room_query.jsx`及快照P-0010／P-0013；交付元件與CSS不依賴原程式或Form.io。

以下行號對應本次原樣快照；後續修訂請以章節／ID為準。

| 範圍 | 起始行／定位 | 用途 |
| --- | --- | --- |
| 頁面／導覽 | 第2章，60；P-0002～P-0009 | 主畫面、A/B/C出發抵達、D/E與初始状态 |
| 欄位 | 第3章，623 | 欄位、值、顯示、驗證、選項及附件 |
| 互動 | 第4章，14156 | 操作、觸發、權限及相對位置索引 |
| 表單動態 | 第5章，26564；FRM-0001～FRM-0007 | 條件、重複列、wizard／一般表單、初始與驗證 |
| 色彩 | 第6章，28559 | 車輛八色映射、事件種類、表單與狀態色 |
| 日曆 | 第7章，28721 | 視圖、工具列、小日曆、篩選、事件與建立 |
| 業務規則 | 第8章，28921 | BR-0121～BR-0141等；區分正常資料契約與歷史缺陷 |
| 操作／權限／API | 第9～11章，29537／29679／29875 | 流程、權限、保存與資料讀取；正常新專案契約仍需對照 |
| 資料／文字／錯誤／驗收 | 第12～15章，31210／31592／33998／34027 | 資料、標籤、驗證訊息、歷史驗收缺陷 |
| 布局 | 第16章，65856；67211響應式；68182之後容器規則 | 元件順序、table列格、columns比例、主要框架、抽屜／彈窗與圖片 |

來源將七份表單列為：A一般使用需求單、B發車／發車抵達、C回程／回程抵達、D工具間、E儀器借用。ABCDE 不代表只重建五個靜態畫面。

## 3. 本批前端必要程式

| 專案根目錄下檔案 | 主要用途 |
| --- | --- |
| `package.json`、`package-lock.json`、`tsconfig.json`、`vite.config.js`、`index.html` | 已有依賴、建置、型別、開發代理與入口 |
| `src/main.tsx`、`src/App.tsx` | React入口、登入、共用框架、側欄、路由與新增入口 |
| `src/NavigationGuard.tsx`、`tests/navigation.mjs` | 單一React Router blocker與beforeunload；ABCDE關閉／離頁／登出、草稿基準、保存／上傳保護及部分read權限隔離驗證。為此次新增規則，不冒充原站證據 |
| `src/Sidebar.tsx`、`src/sidebar.css` | 來源群組、巢狀資產清單、固定底部與手機焦點；規格／驗證見SIDEBAR_LAYOUT_SPEC及SIDEBAR_ACCEPTANCE |
| `src/Calendar.tsx` | 2026-10-10本輪已重建主日曆、自製小日曆／資源日、車牌篩選／手機抽屜、事件與新增帶值；移除額外統計／裝飾區塊；成果見MAIN_SCREEN_ACCEPTANCE.md |
| `src/Bookings.tsx` | 查詢與詳情；BookingForm入口轉至BorrowingForms.tsx，已移除通用五步布局 |
| `src/BorrowingForms.tsx`、`FormLayout.tsx`、`StageFields.tsx`、`forms.css` | 自行實作的ABCDE布局、列交易與樣式；獨立規格見FORM_LAYOUT_SPEC.md |
| `src/Stages.tsx` | B/C出發／抵達、草稿、異常、里程、照片與階段編輯；布局轉至StageFields.tsx |
| `src/ui.tsx`、`src/style.css`、`src/calendar.css` | 共用欄位、上傳、浮層與樣式；主畫面與框架使用新增自行撰寫的calendar.css，借用表單使用自行撰寫的forms.css |
| `src/api.ts`、`src/Access.tsx` | API資料型別、時間、快取與現行權限；保留正常行為 |
| `src/Assets.tsx`、`AssetPresentation.tsx`、`SourceFiles.tsx`、`parity.css` | 原資產清單、五分頁、資訊卡、紀錄表／管理卡、文件預覽及正常CRUD |
| `src/Maps.tsx`、`LocationPages.tsx`、`MapLayout.tsx`、`maps.css` | 四定位入口、350px面板、右側手機90vw抽屜与地圖；舊實作保留但不掛載 |
| `src/StageQueries.tsx`、`SourceEditors.tsx`、`BookingQueries.tsx` | B/C五欄、歷史11欄、自製唯讀／編輯彈窗，不使用完整Schema renderer |
| `src/Admin.tsx`、`Archive.tsx` | Beacon原四欄重建，整合設定／封存等現有延伸功能保留 |

## 4. 保存、回填、附件及相容所需後端

| 專案根目錄下檔案 | 用途 |
| --- | --- |
| `backend/app.py`、`database.py`、`settings.py` | 正式／demo選擇、資料庫及資料路徑；正式不是只跑demo |
| `backend/legacy_api.py`、`legacy_store.py` | 正式PostgreSQL/API、預約／流程、照片與表單JSON保存、鎖、修訂與驗證 |
| `backend/legacy_schema.py`、`legacy_form_fields.json`、`legacy_stage_fields.json` | 欄位與舊資料相容參考；不可把這些轉成完整前端Schema renderer |
| `backend/stages.py`、`demo_app.py`、`fixtures.py` | 隔離示範流程與階段驗證；不能替代正式相容 |
| `backend/permissions.py`、`sso.py` | 現行權限、SSO及申請人／owner界限 |
| `backend/requirements.txt`、`requirements-dev.txt` | 後端與測試依賴 |
| `backend/legacy_integrations.py`、`integrations.py` | 選項／假日／外部整合，按實際呼叫需要閱讀 |

現行後端已包含 A/D/E保存及B/C流程；不要因來源E表未支援而刪掉目前可用實現。新增欄位同步輸入、初始值、驗證、提交、保存編碼、讀取回填、詳情與權限。正式B/C映射還需查看 `legacy_store.py` 的 `STAGE_FIELDS`／`STAGE_CHECKS`。

## 5. 適用測試與環境

| 檔案／位置 | 用途與注意 |
| --- | --- |
| `tests/browser.mjs` | 既有隔離Playwright流程；包含舊設計文字、五步A表與過期selector，需依新畫面調整 |
| `tests/test_integration.py` | 隔離demo/API：驗證、衝突、權限、借用與階段流程 |
| `tests/test_manual_people.py` | 現行手動人員、回填／保存相容 |
| `tests/test_departure_access.py` | 發車代填、申請人／owner與摘要／明細權限 |
| `tests/test_sso.py`、`tests/test_standalone.py` | 登入／獨立依賴相關變更時使用 |
| `tests/legacy-schema.sql`、`tests/test_mysql.py` | 歷史相容參考，MySQL不是現行正式部署必要服務 |

現行命令：`npm run check`、`npm run build`、`npm run test:browser`、`npm run test:api`。先讀測試的隔離方式再執行。開發前端預設5174，代理到8001；`AMS_API_TARGET`可覆寫，確認不佔現有正式服務埠。

本次樣式試看已用Playwright Chromium執行，瀏覽器啟動時需現存函式庫：`/home/c113118138/.cache/polimax-browser-deps/usr/lib/x86_64-linux-gnu`。可在隔離瀏覽器子程序設定 `LD_LIBRARY_PATH`；這是本機工具環境，不是交付網站的執行依賴。若新環境沒有該目錄，依其正常瀏覽器安裝方式準備，不能讓網站依賴它。

不要把 `.env`、`env`、SSO／Apple session、真實資料庫備份或 `.data` 私密資料貼給下一個模型當提示詞。程式／文件與匿名化測試資料已足以開始本批工作。

## 6. 可依需要研究的外部工作區檔案

這些路徑僅供研究，不能加入重建網站的日常依賴；若換環境不存在，記錄資料不足，不能聲稱已核對原頁。

| 位置 | 研究用途 |
| --- | --- |
| `/home/c113118138/polimax_react_on/src/pages/BorrowManagement/formio/` | 七種原表單頁的預設、條件、回填、wizard按鈕、照片及局部樣式研究；不整份搬用 |
| 同專案 `src/pages/BorrowManagement/calender/` | 原日曆布局、篩選、工具列與事件研究（目錄拼字為calender） |
| 同專案 `src/components/Sidebar/Sidebar.jsx`、`src/components/MainContent/` | 原共用框架與編輯浮層布局 |
| 同專案 `src/components/MainContent/FormioEditor.jsx` | 表格／重複列樣式覆寫；注意是編輯浮層，不能無條件套所有新增頁 |
| 同專案 `src/theme/ThemeProvider.jsx`、`global.css`、`index.html` | 字體、主題、全域樣式與CSS載入順序 |
| 同專案 `node_modules/formiojs/`、`@formio/react/`、`@formio/js/`、`bootstrap/` | 當時可讀套件樣式／模板研究；不複製套件進交付前端 |
| `/home/c113118138/polimax_carAPI_on/app.py` | 原保存對照與缺陷研究；不得恢復原後端執行依賴 |
| `/home/c113118138/PMXAgent-deploy-package/` | 按必要性核對定位／設備來源及部署文件；本輪重建定位布局，不修改外部接收器 |

## 7. 已確認的樣式研究與尚未確認事項

本次可讀的原專案安裝版本：`formiojs 4.21.7`、`@formio/react 6.1.1`、`@formio/js 5.2.3`、`bootstrap 5.3.8`。原程式同時使用不同世代套件；package.json的版本範圍、實際安裝版本與正式站部署版本不能混同。

樣式試看圖只載入本機CSS，手寫HTML；隔離頁面未用原主題與完整原站CSS疊加。量到基礎輸入38px高、6px 12px內距、6px圓角、16px字體、24px行高，這些是樣式樣本結果，不能直接宣稱所有原頁都用相同值。

`FormioEditor.jsx`約760–812行静態可確認：一般table為auto布局／100%寬；儲存格宣告150px、文字可換行、靠上及靠左；checkbox右距6px。其editgrid列宣告橫排、12px間距、10px內距、1px #ccc框、6px圓角、#fafafa背景；最後操作區最大60px。須查原DOM及CSS適用範圍後寫入布局規格，宣告欄寬不等於每個視窗下的最後像素寬。

來源第16章已有共用框架與部分斷點規則，例如桌面側欄250px、頂部85px，行動頂部60px／侧欄抽屜280px；日曆篩選右側300px，手機改浮動控制與300px右抽屜；行動判斷max-width:768px。這些屬靜態定義確認，仍需用隔離畫面與已完成要求核對。

還需補齊：完整字體／字級／行高、panel與欄位內外距、表格與保存摘要欄比例、各狀態按鈕對齊、不同寬度最後排列、照片控制、正式原頁CSS疊加結果，以及缺陷影響下的預期畫面。兩份來源的未知事項不得直接寫成已確認。

本次尚未逐頁核對原系統ABCDE正式畫面。`/tmp`曾有A/E等截圖，但來源未確認且中文字型顯示缺失，不能當正式原頁證據；本交接未收錄那些圖。下一個Codex應在安全隔離、阻斷通知／正式寫入的條件下研究，或使用可確認來源的既有畫面證據，並記錄方法。
