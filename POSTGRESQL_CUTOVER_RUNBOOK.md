# PostgreSQL 搬移、發版與回復手冊

> 專案名稱與路徑更新：2026-10-07。專案名稱為 `polimax_refactor`，本機目錄為 `/home/c113118138/polimax_refactor`。

更新：2026-10-05。初次MySQL→PostgreSQL切換已完成；本手冊現在處理現行PostgreSQL架構的搬機／升級／回復。MySQL不再是預設回復目標，不能以改模式忽略已寫入的PostgreSQL業務資料。

## 1. 操作前確認

- 記錄版本、服務帳號、網站入口、SSO公開網址與callback、正式／封存庫、持久資料路徑及備份位置。
- 列出所有寫入者：網站、外部PMXAgent MQTT接收器、FindMy匯入、權限更新、封存與其他上游。網站advisory lock不能保證阻止所有外部寫入。
- 新主機準備PG16/PostGIS、Python/Node、pg_dump/pg_restore、Nginx/systemd及有效SSO配置，先在隔離環境還原演練。
- 確認備份包含正式庫、啟用封存時的封存庫、JSON、附件、權限、FindMy資料及私密設定；自訂路徑額外核對。參見[搬機清單](deploy/STANDALONE.md)。

## 2. 一致停寫與備份

安排維護窗口後停止實際網站、PMX接收器與FindMy寫入，暫停封存timer及會改權限檔的程序；暫停timer不會停止已執行的oneshot，須確認相關作業已結束。保留PostgreSQL運行。

在專案根執行現行備份：

```bash
.venv/bin/python scripts/backup_postgresql.py
```

確認輸出BACKUP_COMPLETE、manifest與postgresql.dump、expired.dump（封存啟用時）、persistent.tar。用SHA-256對manifest核對檔案，pg_restore --list檢查dump可讀、tar清單檢查業務子目錄。備份內容含密鑰，不進Git。

## 3. 還原與切換

1. 在目標建立不同名稱的隔離驗證庫／正式與封存庫，啟用PostGIS；從有效dump還原完整schema與資料，不能拿測試schema替代。
2. 使用`pg_restore --no-owner --no-acl`，密碼透過本機互動或私密PGPASSFILE，不放命令列／文件。已還原PostGIS欄位與trigger時不要重跑add_location.sql。
3. 還原persistent.tar並確認設定與data路徑指向目標；自訂路徑另行搬入。可不搬sso/session讓使用者重新登入；FindMy須搬session/cache或重新Apple登入。
4. 核對表筆數、主鍵、序列、view、正式與封存schema、表單關聯、附件雜湊與權限manifest；既有缺失記錄仍保留，不標成已修復。
5. 明確設定AMS_DATABASE_MODE=postgresql及目標POSTGRES_*，設定封存庫與旗標；更新SSO公開網址／callback及Nginx／服務路徑。
6. 重建venv、npm ci、npm run build，先啟網站只讀驗收，再啟接收器與FindMy；同一時間只允許一套正式寫入者。
7. 兩網站health應回PostgreSQL；真SSO、角色、表單、附件、定位與封存查詢通過後，恢復備份與清理排程並核對輸出。

讀取API驗收可使用scripts/verify_postgresql_api.py；完整寫入流程在隔離庫執行，不以demo成功代替正式驗收。

## 4. 發版與失敗回復

程式更新先隔離檢查、保存目前版本與一致備份、build、restart所用實例。若未改schema且新版本未產生不相容資料，可回原程式與dist；若有schema或資料格式變更，需依遷移計畫處理，不能只降版程式。

切換後已有新表單／附件／定位資料時，先停寫、備份失敗現況，再決定重放或保留新增資料；回復資料庫與持久檔案必須配對版本。對封存前後資料也須同時考慮兩庫，不單獨覆蓋其中一庫。完成回復後再核對SSO、附件、health與上游，才恢復排程。

## 5. 執行紀錄

每次保存版本、時間、備份manifest、核對結果、失敗／缺檔、操作人與回復決定。過去2026-09-22切換紀錄見[遷移基準](POSTGRESQL_MIGRATION_BASELINE.md)，其中舊筆數與服務結果不是本次操作的驗收證據。本次文件更新未實施停寫、還原或切換。
