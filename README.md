# polimax_refactor / AMS 交接手冊

2026-10-12新增 [POLIMAX_SYSTEM_SPEC.md](POLIMAX_SYSTEM_SPEC.md)：以功能、畫面、API及驗收為準的獨立實作規格，預設PostgreSQL；語言、框架、內部架構及資料表設計由重建AI決定。含完整欄位、布局、操作、權限、請求／回應、部署責任與待確認事項，沒有專案壓縮包或解壓成品流程。

原 [POLIMAX_REBUILD_SPEC.md](POLIMAX_REBUILD_SPEC.md) 仍保留，是2026-10-12套用Logo後的實作快照與還原文件；重新設計內部實作時，以新的功能／畫面／API規格為準，不要求照搬快照中的程式。

2026-10-11 原站其餘畫面補齊：歷史／B/C查詢、自製查看編輯彈窗、原資產清單／五分頁／資訊卡、保險／成本／維護／檔案／人員、附件預覽及定位四頁。布局見 [SITE_PARITY_LAYOUT_SPEC](docs/reconstruction/SITE_PARITY_LAYOUT_SPEC.md)，截圖與測試見 [SITE_PARITY_ACCEPTANCE](docs/reconstruction/SITE_PARITY_ACCEPTANCE.md)，本輪後端部署及儀器文件備份見 [SITE_PARITY_PREVIEW](deploy/SITE_PARITY_PREVIEW.md)。`npm run preview:main`提供18024隔離預覽；先前修改保留。

2026-10-10 主畫面重建：日曆、右側小日曆／車牌篩選、手機抽屜及共用框架已依來源布局整理。ABCDE表單已接續重建，含B/C出發及抵達。布局與未知項目見 [LAYOUT_SPEC](docs/reconstruction/LAYOUT_SPEC.md)，畫面／測試見 [主畫面驗收](docs/reconstruction/MAIN_SCREEN_ACCEPTANCE.md)，隔離可操作預覽與部署補充見 [MAIN_SCREEN_PREVIEW](deploy/MAIN_SCREEN_PREVIEW.md)。`npm run build` 後以 `npm run preview:main` 開啟獨立示範資料預覽（18024），不取代正式SSO入口。

> 專案名稱與路徑更新：2026-10-07。專案名稱為 `polimax_refactor`，本機目錄為 `/home/c113118138/polimax_refactor`。

更新：2026-10-05。現行正式系統使用 PostgreSQL／PostGIS；MySQL 已不再用於本專案正式服務。程式尚留的 MySQL 驅動、分支與測試屬相容工具，不是部署必要服務。

表單布局、畫面證據與預覽見 [FORM_LAYOUT_SPEC](docs/reconstruction/FORM_LAYOUT_SPEC.md)、[FORM_ACCEPTANCE](docs/reconstruction/FORM_ACCEPTANCE.md)、[FORMS_PREVIEW](deploy/FORMS_PREVIEW.md)。`npm run preview:forms` 使用獨立示範資料（18025）。

側欄已接續重建來源群組、車輛／設備巢狀清單與固定底部。規格見 [SIDEBAR_LAYOUT_SPEC](docs/reconstruction/SIDEBAR_LAYOUT_SPEC.md)，截圖及驗證見 [SIDEBAR_ACCEPTANCE](docs/reconstruction/SIDEBAR_ACCEPTANCE.md)；`npm run test:sidebar`可重跑隔離驗證。

接續補上 ABCDE 未保存離頁／關閉／登出保護，以及側欄各入口的 read 權限和空群組隱藏。操作規則、截圖、測試邊界見 [NAVIGATION_SAFETY_ACCEPTANCE](docs/reconstruction/NAVIGATION_SAFETY_ACCEPTANCE.md)；`npm run test:navigation`使用18028一次性隔離資料驗證。

車輛／作業區使用查詢接續改為來源11／8欄表格、多時段合併與原區塊順序。規格見 [QUERY_LAYOUT_SPEC](docs/reconstruction/QUERY_LAYOUT_SPEC.md)，驗證／截圖見 [QUERY_ACCEPTANCE](docs/reconstruction/QUERY_ACCEPTANCE.md)，預覽及部署見 [QUERIES_PREVIEW](deploy/QUERIES_PREVIEW.md)；`npm run test:queries`使用18029一次性隔離資料。

## 1. 架構與閱讀入口

規格導讀：[PROJECT_SPEC_view.md](PROJECT_SPEC_view.md) 將規格章節對應至畫面、API、程式與資料位置，適合第一次閱讀專案時搭配使用。

React 18 + TypeScript + Vite 前端，FastAPI／Uvicorn 後端；公司 SSO 驗證身份，本地 AMS 政策快照控制權限。PostgreSQL 保存資產、預約索引、流程與定位；完整表單 JSON、附件、權限與 FindMy session 保存於專案持久目錄。

```text
瀏覽器 → Nginx（部署入口）→ FastAPI（dist + /api）
                              ├─ 公司 SSO
                              ├─ PostgreSQL / PostGIS 正式庫
                              └─ .data 表單 / 附件 / 權限 / session
FindMy 匯入器、外部 MQTT 接收器 → PostgreSQL
封存作業 → PostgreSQL 封存庫；備份作業 → 雙庫 dump + 持久檔案
```

| 文件 | 用途 |
| --- | --- |
| [完整規格](PROJECT_SPEC.md) | 工具版本、前端路由、全部 API、資料與業務規則 |
| [部署手冊](deploy/README.md) | 安裝、設定、啟動與發版 |
| [搬機清單](deploy/STANDALONE.md) | 資料庫、持久資料、外部接收器與登入依賴 |
| [主要時序](SEQUENCE_DIAGRAMS.md)、[逐步操作](SYSTEM_MAINTENANCE_GUIDE.md#flows) | 登入、預約、車輛、附件、定位與封存流程 |
| [驗收說明](ACCEPTANCE.md) | 現行驗收項目與既有測試紀錄的範圍 |
| [功能與欄位需求](../POLIMAX_原始_SPEC.md) | 業務欄位及現行架構對照，含原表單相容附錄 |

`backend/app.py` 在 `AMS_DATABASE_MODE=postgresql` 載入 `legacy_api.py`。`legacy_*` 是既有 schema／JSON 的相容層，不依賴舊專案、Redis mini-engine 或舊附件服務。`demo` 才載入 SQLite 示範後端，正式連線失敗不會回退 demo。

## 2. 安裝與啟動

部署基準 Python 3.12、Node.js 20+、PostgreSQL 16 與 PostGIS。正式資料庫必須由現有備份還原／受控 schema 建立；app 不自動建立完整業務結構。

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
npm ci
npm run build
npm start
```

第一次安裝將 `.env.example` 複製為 `.env` 後，**明確設定 `AMS_DATABASE_MODE=postgresql` 並填 `POSTGRES_*`**，再啟動。既有設定不要覆蓋。程式與範本仍含 mysql 預設，未指定模式不能當作現行正式配置。

| 模式 | 埠／命令 | 說明 |
| --- | --- | --- |
| 單一服務 | `npm start`，5173 | FastAPI 提供 dist 與 API |
| 開發後端 | `.venv/bin/python -m uvicorn app:app --app-dir backend --host 127.0.0.1 --port 8001 --reload` | 前端另啟 |
| 開發前端 | `npm run dev`，5174 | Vite 代理 `/api` 到8001；AMS_API_TARGET可覆寫 |
| systemd user | polimax-next@5173／@5174 | 範本支援按埠啟動，部署依實際實例 |
| Nginx 範本 | 80 → 127.0.0.1:5174 | 公開IP入口；新主機調整server_name |

Vite與正式API不可佔同一埠。`npm start` 讀 dist，修改前端後必須 `npm run build`。SSO公開網址與callback必須符合公司註冊，localhost不保證能登入。

## 3. 設定與資料

設定優先序：程序環境 > `.env` > `env`；相對資料路徑依專案根解析。

| 設定 | 現行用途 |
| --- | --- |
| AMS_DATABASE_MODE | 正式固定postgresql；demo僅隔離示範 |
| POSTGRES_HOST/PORT/DATABASE/USER/PASSWORD | 正式連線，port預設5432 |
| AMS_ARCHIVE_DATABASE / AMS_ARCHIVE_ENABLED | 封存庫名、完成初始化後啟用 |
| AMS_AUTH_MODE / PREVIEW_LOGIN_ENABLED | 正式sso／0 |
| SSO_SERVER/SSO_CLIENT_ID/SSO_CLIENT_SECRET | 公司SSO設定 |
| PUBLIC_WEB_URL / SSO_REDIRECT_URI | 對外網址與callback，預設 `/api/callback` |
| AMS_DATA_DIR | 預設.data |
| AMS_RESPONSES_DIR | 預設data/responses |
| AMS_SSO_POLICY_MANIFEST / AMS_POLICY_FILE | 權限manifest／明確政策檔 |
| AMS_BACKUP_DIR | 預設備份位置.backups/scheduled |

完整設定見[規格第12節](PROJECT_SPEC.md#12-設定規格)。部分helper直接讀程序環境，尤其假日及選項檔；以實際呼叫方式配置。

```text
.data/
  responses/        # A/B/C/D/E JSON與修訂備份
  files/            # uuid原檔、uuid.json索引
  permissions/      # manifest、快照或政策
  sso/              # session/token/state，搬機可要求重登入
  findmy/           # Apple session與Anisette快取
  session.key       # 本地測試cookie簽章金鑰
```

只備份PostgreSQL不足以還原。雙庫、表單、附件、權限與FindMy登入資料須一致保存；備份含設定與私密資料，不能進Git。自訂資料路徑須核對備份腳本覆蓋範圍，詳見[封存備份](deploy/ARCHIVE_RETENTION.md)。

## 4. 功能、流程與程式位置

A車輛借用、D作業區、E儀器借用是主表；B去程、C回程包含start/arrival。車輛流程為 `PENDING → DEPARTURE → DEPARTURE_ARRIVED → RETURN → RETURN_ARRIVED`。預約衝突包含相接邊界，修改含revision檢查；A改期換新編號、D/E保留原號。

| 檔案 | 職責 |
| --- | --- |
| src/App.tsx、api.ts、Access.tsx | 路由、登入、API、權限與快取 |
| src/Bookings.tsx、Stages.tsx、Calendar.tsx | 預約、出回程、日曆 |
| src/Assets.tsx、Maps.tsx、Admin.tsx、Archive.tsx | 資產、定位、管理與封存 |
| backend/legacy_api.py、legacy_store.py | 正式API、PostgreSQL／JSON讀寫、鎖與驗證 |
| backend/legacy_schema.py、legacy_form_fields.json | SQL與舊表單欄位映射 |
| backend/sso.py、permissions.py | SSO與有效權限 |
| backend/legacy_integrations.py、gps_history.py | 定位、Beacon、掃描、軌跡 |
| backend/archive_api.py、retention.py | 封存查詢、完成登記與封存引擎 |
| integrations/findmy/ | Apple登入、取報告與PostgreSQL匯入 |
| scripts/backup_postgresql.py、archive_maintenance.py | 雙庫備份、封存維運 |

新增欄位要同步輸入、初始值、編輯回填、送出、詳情、後端驗證與權限。新版表單欄位可存 `_polimax_next.content`；需要SQL搜尋時才做schema調整。B/C正式映射在legacy_store的STAGE_FIELDS/STAGE_CHECKS，不是只改legacy_stage_fields.json。

## 5. 定位、附件與外部依賴

- 車輛最新GPS按CarList.client_id對gps_readings.client_id查詢；只有vehicle，沒有設備共用positions來源。
- 軌跡最近90天、created_at起含迄不含、預設1000點，資料庫先過濾數值座標再抽樣；API直接讀latitude/longitude，PostGIS仍供schema及封存使用。
- FindMy按Beacon ID讀new_reports，專案內匯入器每小時取Apple報告，寫FindMy及new_reports；MQTT GPS／掃描接收器在外部PMXAgent套件。
- 一般附件10MiB、stage-photo 1GiB，保存於本地files及metadata；無舊檔案服務轉送。歷史缺檔仍須補原檔，不能假成功。
- 權限sync重讀本地manifest／政策，不會自動向公司權限中心取新快照。正式通知API只讀notification，check回409；上游通知需另行維運。
- 定位頁仍有demo文案，且最新接收時間API `latest_report_time` 與UI `updated_at` 尚未對齊；文件不把這些文案當正式資料來源。

## 6. 驗證與發版

```bash
npm run check
npm run build
.venv/bin/python tests/test_sso.py
.venv/bin/python tests/test_standalone.py
.venv/bin/python tests/test_manual_people.py
.venv/bin/python tests/test_retention.py
```

retention測試需要PG16及PostGIS，在臨時叢集驗證。demo/API/Playwright用於隔離UI與流程測試，不能替代正式PostgreSQL相容或真SSO驗收。`tests/test_mysql.py`僅歷史相容測試，不是現行部署驗收要求。完整範圍見[驗收](ACCEPTANCE.md)。本次文件更新未重跑上述測試。

發版先完成適用隔離檢查、備份、build，依實際服務restart，再查health回PostgreSQL、SSO、表單、附件與定位。網站／清理／備份共用advisory lock；外部接收器不一定使用相同鎖，完整搬機仍須停所有寫入者。

## 7. 其他維運文件

- [GPS保存與查詢](deploy/GPS_RETENTION.md)、[歷史封存](deploy/ARCHIVE_RETENTION.md)、[PostGIS](deploy/POSTGIS.md)。
- [FindMy部署](deploy/FINDMY_POSTGRESQL.md)、[定位效能](scripts/LOCATION_BENCHMARK.md)。
- [系統流程與維運手冊](SYSTEM_MAINTENANCE_GUIDE.md)：架構與資料庫基準、逐步流程、搬移回復及歷史紀錄。

## 專案改名與相容名稱

2026-10-07 將專案目錄由 `polimax_next` 改為 `polimax_refactor`，網站、FindMy、封存、備份服務及 Python 虛擬環境路徑均已更新。後續指令請使用新目錄。

systemd 服務名稱仍為 `polimax-next@5173`／`polimax-next@5174`，部署範本檔名與 npm 套件名稱 `polimax-next` 亦沿用既有名稱。表單 JSON 的 `_polimax_next` 是資料格式欄位，為維持既有資料相容而保留。這些名稱不代表仍使用舊目錄。
