# PostgreSQL 現行資料架構與遷移紀錄

> 專案名稱與路徑更新：2026-10-07。專案名稱為 `polimax_refactor`，本機目錄為 `/home/c113118138/polimax_refactor`。

更新：2026-10-05。網站與定位接收器已使用PostgreSQL；MySQL不再作正式資料來源。本文的舊筆數只表示有日期的遷移紀錄，不是今日庫存、資料量或服務狀態。

## 現行基準

- 正式庫polimax_PostgreSQL；封存庫polimax_PostgreSQL_Expired，同一PostgreSQL instance，PostGIS在兩庫啟用。
- 網站以AMS_DATABASE_MODE=postgresql及POSTGRES_*連線；backend/app.py載入legacy_api／legacy_store，反射既有表，不依賴舊Python專案。
- 两個網站入口5173／5174共享資料庫與專案持久資料，Nginx範本代理5174；實際啟用狀態需systemd核對。
- 外部PMXAgent GPS／室內／戶外接收器寫入PostgreSQL；專案內FindMy匯入器寫FindMy／new_reports。
- PostgreSQL advisory lock取代現行寫入路徑的MySQL命名鎖；表單JSON仍是完整內容來源，必須與資料庫一致備份。
- 每日03:30封存，04:00雙庫及持久檔案備份；timer時區與啟用狀態以主機為準。

## Schema與工具

資產CarList／EquipmentList／BeaconList；業務formio_responses／form_flows、insurance_records／cost／vehicle_records／garage_files／vehicle_managers；定位與事件表見[完整規格](PROJECT_SPEC.md)。

遷移保留混合大小寫表／欄名及原主鍵。三個view為Findmy_latest、car_realtime、latest_scanned_devices，其定義在scripts/postgresql_views.sql。PostGIS將gps_readings／new_reports／FindMy新增location geography(Point,4326)、trigger與GiST，API仍讀數值座標。

封存初始化另建立polimax_retention_decisions、polimax_retention_cursor、polimax_archive_batches、polimax_archive_files。不能把歷史「23表／3view／85索引」當成目前完整schema數量，也不能用tests/legacy-schema.sql建立正式庫。

| 工具 | 目前角色 |
| --- | --- |
| scripts/verify_postgresql.sql | 初步schema與筆數檢查；不是完整業務驗收 |
| scripts/verify_postgresql_api.py | 指定庫只讀API核對；密碼在本機輸入 |
| scripts/backup_postgresql.py | 現行雙庫與持久資料備份 |
| scripts/archive_maintenance.py | 現行封存初始化／預覽／完成登記／清理 |
| scripts/add_location.sql | 一次性PostGIS遷移，已套用庫不得重跑 |
| scripts/export_postgresql.py | 已完成MySQL轉換的歷史工具，不屬日常部署 |
| scripts/prepare_cutover_pgpass.py、backup_cutover.sh | 初次切換輔助工具，不作現行搬機標準流程 |

## 已記錄的里程碑

| 日期 | 事件與驗證範圍 |
| --- | --- |
| 2026-09-21 | 隔離匯入舊庫23表、85索引，轉換3view；當時測試快照不作現行一致備份 |
| 2026-09-22 | 正式停寫並遷移；23表442列逐表雜湊一致。修正CHAR(1)空值補空白差異為VARCHAR(1) |
| 2026-09-22 | 新.env明確啟用PostgreSQL；兩入口health回PostgreSQL，SSO跳轉303、Nginx200、接收器連MQTT；當時尚未代表完整真帳號與硬體寫入驗收 |
| 2026-09-22 | PostgreSQL自訂格式與持久檔案備份完成，pg-backup timer啟用；原切換備份保存在migration_backups私有目錄 |
| 2026-09-24 | 封存庫初始化與啟用、雙庫備份、隔離封存測試；首次清理0筆，39份缺JSON或附件保留 |
| 2026-09-30 | 獨立依賴盤點、FindMy環境與讀取測試；未在另一台機器完成整套還原 |

曾保留的MySQL與舊切換點備份只是歷史回復材料，不代表仍使用，也不能直接恢復成目前最新資料。本文不提供重新執行MySQL切換的操作步驟。

## 維運入口

現行部署見[部署手冊](deploy/README.md)，搬機／回復見[PostgreSQL runbook](POSTGRESQL_CUTOVER_RUNBOOK.md)，雙庫保留與備份見[封存規格](deploy/ARCHIVE_RETENTION.md)。資料量、服務狀態與真上游驗收須當次查詢記錄，本次只更新文件。
