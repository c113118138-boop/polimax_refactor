# polimax_refactor 現行驗收與測試範圍

> 專案名稱與路徑更新：2026-10-07。專案名稱為 `polimax_refactor`，本機目錄為 `/home/c113118138/polimax_refactor`。

更新：2026-10-05。正式架構為React／FastAPI／PostgreSQL／PostGIS／公司SSO，本地JSON及附件持久保存。SQLite僅是隔離demo，MySQL不再是正式驗收環境。

## 1. 現行驗收矩陣

| 範圍 | 必須核對 |
| --- | --- |
| 部署 | dist與API可讀、health回PostgreSQL、兩入口共享DB與持久資料 |
| SSO | 真公司帳號、callback、state一次性、session過期與refresh、登出 |
| 權限 | 多角色、read/create/write/submit/delete、欄位限制與owner；sync只重讀本地來源 |
| A/D/E | 實際保存、重載編輯、包含邊界衝突、停用資源、revision；A換號、D/E原號 |
| A/B/C | 四次advance、B/C父關聯、檢查與人員、里程確認、抵達不小於出發、重複／過期送出409 |
| 資產與紀錄 | 車輛／設備、保險／費用／維護／車庫／管理人員、軟刪除與唯一識別 |
| 附件 | 原檔與metadata保存、10MiB／stage-photo1GiB、圖片預覽、下載、缺檔404；無舊服務轉送 |
| 定位 | 直接數值座標、車輛client_id、最近90天軌跡、抽樣與NULL；真上游寫入另驗 |
| FindMy | Apple session、背景匯入、FindMy/new_reports一致與去重、UTC時間 |
| 場內掃描 | 外部接收資料、每站每major最新、5分鐘在線、10秒UI刷新 |
| 封存 | 完成登記、來源指紋、封存讀回驗證、缺檔保留、最新定位例外、原始資料權限 |
| 備份還原 | 雙庫dump、持久檔案、SHA-256、隔離還原與JSON／附件關聯 |
| UI與時區 | 桌面／手機、台北輸入與顯示、非台北瀏覽器、秒數往返 |
| 通知 | 正式只查notification，check409；不把demo模擬成功當真通知寄送 |

## 2. 測試入口

```bash
npm run check
npm run build
.venv/bin/python tests/test_sso.py
.venv/bin/python tests/test_standalone.py
.venv/bin/python tests/test_manual_people.py
.venv/bin/python tests/test_retention.py
```

retention需要PG16與PostGIS，在/tmp臨時叢集驗證；不讀正式帳密。SSO測試模擬上游，不能替代公司真帳號。test_standalone驗設定與搬移，不等於完成另一主機部署。

隔離demo流程與UI：

```bash
npm run test:api
npm run build
npm run test:browser
AMS_TEST_MOBILE=1 npm run test:browser
node tests/browser_location.mjs
```

需Chromium與系統函式庫；browser_location使用mock定位。test_mysql.py僅舊相容測試，不要求啟MySQL部署。scripts/verify_postgresql_api.py用於指定PG庫只讀API驗收；LOCATION_BENCHMARK是效能比較，不是正確性或全端延遲驗收。

## 3. 已有驗證紀錄

| 日期 | 紀錄範圍 |
| --- | --- |
| 2026-09-11 | SQLite demo 13組API整合、build、桌面／手機Playwright；完成四階段、附件與非台北瀏覽器時區驗證 |
| 2026-09-22 | 正式PG遷移、兩入口health、SSO303跳轉、Nginx200、隔離還原與資料雜湊；跳轉不等於真帳號全程 |
| 2026-09-24 | 20項隔離封存測試與雙庫備份；當時standalone曾有1項快照路徑失敗，不能稱全部檢查通過 |
| 2026-09-30 | SSO9項、獨立部署4項通過；FindMy依賴與取報告測試，未異機還原全套 |

以上是原文件紀錄的歷史結果，不表示2026-10-05已重跑。本次修改文件沒有執行功能測試、正式登入、通知、部署或資料變更。

## 4. 驗收邊界與待修項

- 定位UI保留部分測試文案，latest_report_time與updated_at顯示欄位仍未對齊。
- 正式positions只含車輛；設備走Beacon/FindMy，沒有設備共用GPS軌跡。
- 正式未提供自行寄通知、即時HR完整清單、外部權限自動同步、主管審批、ERP或部分數量庫存配置。
- B/C刪除不自動回退父流程，測試須確認缺階段時行為，不應推定流程完整。
- 歷史附件缺失以migration-report為準，不能用網站正常代替完整檔案验收。
- 完整規格與需求見[PROJECT_SPEC](PROJECT_SPEC.md)、[業務欄位規格](../POLIMAX_原始_SPEC.md)。
