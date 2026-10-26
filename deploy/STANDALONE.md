# PostgreSQL 獨立部署與搬機清單

> 專案名稱與路徑更新：2026-10-07。專案名稱為 `polimax_refactor`，本機目錄為 `/home/c113118138/polimax_refactor`。

> 更新：2026-10-05。現行正式架構為 PostgreSQL／PostGIS + FastAPI + React + 公司 SSO。文件更新依程式與部署紀錄核對，未重新執行正式環境驗收。

## 專案內應一併移植的內容

| 項目 | 位置／方式 |
| --- | --- |
| 網站前後端 | `src/`、`backend/`、`package.json`、`package-lock.json`，部署前重建 `dist/` |
| 設定與密鑰 | `.env` 與 `env`，不在 Git；`.env` 優先於 `env` |
| 表單、附件、權限 | `.data/responses`、`.data/files`、`.data/permissions` |
| 現行權限 | 依 `AMS_SSO_POLICY_MANIFEST` 或 `AMS_POLICY_FILE`；部署紀錄曾使用 `.data/permissions/latest-AMS-local.json`，須連同 manifest 指定的 snapshot 複製；SSO 預設也只讀專案內資料 |
| FindMy | `integrations/findmy/`；依 requirements 重建 `.venv-findmy`；複製 `.data/findmy` 或重新 Apple 登入 |
| 備份／封存排程 | `scripts/backup_postgresql.py`、`scripts/archive_maintenance.py` 與 `deploy/` 服務範本 |
| Session | `.data/sso` 與 `.data/session.key`；搬機可要求重新登入，不需沿用 session |

備份預設位置改為專案 `.backups/scheduled`，可由 `AMS_BACKUP_DIR` 指定其他磁碟；舊的外部備份保留原處。新備份包含 FindMy 登入資料。Git clone 不會帶入 `.env`、`env`、`.data`、`.backups`，只搬原始碼不足以恢復正式系統。虛擬環境應重新建立。

## 仍需另外部署或連線的外部服務

- PostgreSQL／PostGIS 與目前使用的封存資料庫：須匯出、還原資料庫，資料實體不在 Git 專案。備份腳本會依封存設定產生主庫及封存庫 dump。
- 公司 SSO：需更新目標主機公開網址及 IDP 登錄的 Redirect URI。
- Apple FindMy 上游服務。
- PMXAgent-deploy-package：依使用者要求獨立移植，未修改程式或 systemd 設定；三個定位接收器需設定相同 PostgreSQL，並能連線 MQTT broker。
- 地圖使用 OpenStreetMap 圖磚；字型使用 Google Fonts。
- Nginx、systemd、Python、Node.js 與 PostgreSQL 客戶端是主機套件。

## 不再需要的舊專案執行依賴

網站不需 `polimax_carAPI_on`、`polimax_react_on` 或舊 mini-engine／Redis 權限服務。舊服務保留不動，避免影響其他用途。`scripts/migrate_storage.py` 是一次性舊資料匯入工具，其舊資料結構引用不是日常依賴。`legacy_*` 表示相容資料格式，不會匯入舊專案程式。

## 搬機注意

`deploy/` 的網站、清理、備份服務範本含目前帳號的絕對路徑，新主機需調整；FindMy 範本使用 `%h/polimax_refactor`。同時調整 Nginx IP、SSO 公開網址、資料庫及外部定位接收器連線設定。既有切換紀錄屬歷史文件，請以本頁及目前設定為準。

## 2026-09-30 已記錄驗證（未於本次重跑）

SSO 9 項與獨立部署 4 項測試通過；兩個網站 health 與 Admin 權限檢查正常。FindMy 新環境 pip check 通過，成功載入本專案 Apple session、讀取 85 個啟用裝置並取得回報。未在另一台主機實際還原整套系統；既有歷史附件缺失不由本次搬移補回，詳見舊切換紀錄。

## 現行搬機順序與核對

正式固定AMS_DATABASE_MODE=postgresql，POSTGRES_*指向目標正式庫，AMS_ARCHIVE_DATABASE指向獨立封存庫；正式SSO／PREVIEW_LOGIN_ENABLED=0。MySQL不需安裝或啟動；原始碼中的相容分支不作部署必要條件。

搬機依[PostgreSQL runbook](../SYSTEM_MAINTENANCE_GUIDE.md#operations)停所有寫入者、雙庫備份、還原業務檔案與配置、驗證後才切換入口與恢復排程。原機sso/session可不保留；FindMy session/cache需搬入或重新登入。

注意backup_postgresql.py目前只打包專案固定.data/responses、files、permissions、findmy以及env/.env。若用外部AMS_DATA_DIR、AMS_RESPONSES_DIR或政策路徑，必須另行一致備份與還原；檢查manifest與tar清單，不能因BACKUP_COMPLETE就假設自訂路徑已包含。

主機套件、SSO、Apple／Anisette、MQTT broker、外部接收器、OpenStreetMap圖磚與Google Fonts均需目標網路可達。完整工具與API見[PROJECT_SPEC](../PROJECT_SPEC.md)。
