# PostgreSQL 正式部署與維運

> 專案名稱與路徑更新：2026-10-07。專案名稱為 `polimax_refactor`，本機目錄為 `/home/c113118138/polimax_refactor`。

更新：2026-10-05。現行正式資料庫是PostgreSQL／PostGIS，MySQL不再是網站、定位接收或備份的部署依賴。使用React dist、FastAPI、公司SSO與專案持久檔案；`legacy_*`僅表示既有資料格式相容。

## 1. 安裝與設定

Python3.12、Node20+、PostgreSQL16、PostGIS及pg_dump/pg_restore；網站應用只反射現有表，先從有效備份還原schema和資料。新機完整搬移見[STANDALONE](STANDALONE.md)。

```bash
cd /opt/polimax_refactor
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
npm ci
npm run build
```

第一次部署才複製.env.example為.env，設定檔mode600、資料目錄mode700；不可覆蓋既有設定。範本仍有歷史mysql預設，必須明確改為：

```dotenv
AMS_DATABASE_MODE=postgresql
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DATABASE=polimax_PostgreSQL
POSTGRES_USER=your_application_user
POSTGRES_PASSWORD=fill_locally
AMS_AUTH_MODE=sso
PREVIEW_LOGIN_ENABLED=0
AMS_DATA_DIR=.data
AMS_ARCHIVE_DATABASE=polimax_PostgreSQL_Expired
AMS_ARCHIVE_ENABLED=1
```

`AMS_ARCHIVE_ENABLED=1`僅適用封存庫已经還原或完成初始化的環境。填入SSO_SERVER/CLIENT_ID/CLIENT_SECRET、PUBLIC_WEB_URL與SSO_REDIRECT_URI，須符合公司註冊。優先序程序環境>.env>env，避免服務Environment覆蓋成舊值。

## 2. 業務資料與搬入方式

現在搬機應還原PostgreSQL正式庫、封存庫及持久檔案，不再執行MySQL匯出。

```text
.data/responses/   A/B/C/D/E JSON及修訂
.data/files/       UUID內容與metadata
.data/permissions/ manifest及指向的快照／政策
.data/findmy/      Apple session及Anisette cache
```

sso/session可不搬，讓使用者重新登入。自訂AMS_DATA_DIR、AMS_RESPONSES_DIR、政策路徑須列入還原清單。兩個網站入口若共享資料庫，也必須共享responses/files與權限來源。

`scripts/migrate_storage.py`僅用於首次匯入舊專案表單／附件；`scripts/export_postgresql.py`僅用於歷史MySQL轉換，二者不是PostgreSQL日常部署步驟。歷史missing附件以migration-report.json為準；補原檔與索引，不把錯誤頁當附件，不修改complete掩蓋缺失。

## 3. 服務與反向代理

`npm start`於5173提供dist及API；`npm run dev`是Vite5174，不是正式服務。專案有两種服務範本：

- user服務`polimax-next@.service`：目前路徑/home/c113118138/polimax_refactor，instance埠5173/5174；新機修改路徑。
- 系統服務`polimax-next.service.example`：/opt/polimax_refactor、User/Group=polimax、127.0.0.1:5174，ProtectSystem與ReadWritePaths需涵蓋資料位置。

採user服務時，將已調整的範本安裝至~/.config/systemd/user，再依部署選擇實例：

```bash
systemctl --user daemon-reload
systemctl --user enable --now polimax-next@5173 polimax-next@5174
systemctl --user status polimax-next@5173 polimax-next@5174
journalctl --user -u polimax-next@5174 -n 100 --no-pager
```

無人登入仍需執行時，管理員確認linger。Nginx範本listen80、server_name163.18.26.228、proxy_pass127.0.0.1:5174、上傳1g、timeout120s；新機依網址及TLS終止位置調整。install-nginx.sh是管理員部署工具，執行前核對目標配置。

## 4. 背景服務

| 項目 | 現行責任 |
| --- | --- |
| 外部PMXAgent接收器 | MQTT → GPS／室內／戶外Beacon表；獨立部署且連相同PostgreSQL |
| polimax-findmy-import | 專案內Apple FindMy匯入；hourly、5分鐘隨機延遲、需已有session |
| polimax-gps-cleanup | archive_maintenance --apply；每日03:30 Asia/Taipei |
| polimax-pg-backup | 正式＋封存dump與持久檔案；每日04:00依主機時區 |
| 公司通知上游 | 另行維運；polimax_refactor 正式 check 不送通知 |

排程Persistent會補跑錯過時段；詳見[FindMy](FINDMY_POSTGRESQL.md)、[封存](ARCHIVE_RETENTION.md)。服務範本存在不等於目標機已enable；搬機須核對list-timers、journal與實際輸出。

## 5. 權限與SSO清理

SSO角色來自本地政策／snapshot manifest；更新快照需一併更新manifest指向內容，管理頁sync只重讀，不向外部取新版本。未授權帳號不自動給管理員。

SSO lifespan每天Asia/Taipei午夜清除過期session-*.json，共用檔案鎖避免驗證／登出競爭。登入有效期12小時，超過60秒有請求才重新驗證token；午夜清檔不等於延期或撤銷尚有效session。

## 6. 備份、升級與驗收

完整備份用`scripts/backup_postgresql.py`，封存啟用時應有postgresql.dump、expired.dump、persistent.tar、manifest.json。應用共享鎖不涵蓋所有外部寫入者；搬機或跨系統一致回復須停所有生產程序。備份腳本目前打包專案固定.data子目錄，自訂路徑須額外保護，見[封存備份](ARCHIVE_RETENTION.md)。

升級先隔離檢查、完成備份、npm run build，再restart實際網站實例。驗收：

```bash
curl -fsS http://127.0.0.1:5173/api/health
curl -fsS http://127.0.0.1:5174/api/health
systemctl --user list-timers
```

health應回database=PostgreSQL。再驗證真SSO、角色、表單、附件、GPS／Beacon與FindMy。寫入驗收在隔離庫完成；demo通過不表示真上游成功。回復目前PostgreSQL與持久檔案版本，不能切回舊MySQL後忽略新資料。詳見[回復手冊](../POSTGRESQL_CUTOVER_RUNBOOK.md)。

## 7. 部署紀錄的閱讀方式

2026-09-22正式切換PostgreSQL、2026-09-24封存啟用、2026-09-30獨立搬機盤點屬已紀錄事件，見[遷移紀錄](../POSTGRESQL_MIGRATION_BASELINE.md)。歷史曾接受的15個附件缺失不代表已補齊；實際以持久migration-report為準。本文更新未重啟服務或重新驗收正式主機。
