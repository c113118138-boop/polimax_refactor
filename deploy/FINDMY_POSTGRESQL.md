# FindMy 獨立部署

> 專案名稱與路徑更新：2026-10-07。專案名稱為 `polimax_refactor`，本機目錄為 `/home/c113118138/polimax_refactor`。

> 更新：2026-10-05。現行正式架構為 PostgreSQL／PostGIS + FastAPI + React + 公司 SSO。文件更新依程式與部署紀錄核對，未重新執行正式環境驗收。

程式位於 `integrations/findmy/`，從本專案 `.env`／`env` 讀取 PostgreSQL 設定，不需要舊專案。匯入器只允許目標 PostgreSQL 資料庫名稱 `polimax_PostgreSQL`，並將裝置回報寫入 `FindMy` 與 `new_reports`。

在專案根目錄執行：

```sh
python3 -m venv .venv-findmy
.venv-findmy/bin/python -m pip install -r integrations/findmy/requirements.txt
.venv-findmy/bin/python integrations/findmy/create_findmy_session.py
```

Apple 密碼及 2FA 由互動方式輸入。登入資料存於 `AMS_DATA_DIR/findmy/account.json`，Anisette 快取存於同目錄的 `ani_libs.bin`；預設 `AMS_DATA_DIR=.data`。兩者為私密資料，不進 Git，搬機時需妥善複製，或重新登入。首次使用可能需要從 Apple 下載支援套件。

`deploy/polimax-findmy-import.service` 與 `.timer` 提供每小時匯入。範本假設專案在 `%h/polimax_refactor` 且使用 `.data`；若位置或資料目錄改變，需修改服務路徑及 `ConditionPathExists`。安裝至 `~/.config/systemd/user/` 後執行：

```sh
systemctl --user daemon-reload
systemctl --user enable --now polimax-findmy-import.timer
systemctl --user start polimax-findmy-import.service
```

排程要求已有 Apple session，不會詢問帳密。手動單次執行：

```sh
.venv-findmy/bin/python integrations/findmy/findmyupdate.py
```

FindMy 環境包含後端 requirements，避免匯入資料庫設定時缺少 GeoAlchemy2。資料寫入具去重處理。

## 現行架構與驗收界線

正式庫需AMS_DATABASE_MODE=postgresql，服務從專案配置載入POSTGRES_*；MySQL不再用於FindMy。API `/api/findmy/{id}`查new_reports.sheet_id最新timestamp/id，網站刷新只讀DB；正式reports/import與sync仍回409，不啟動背景匯入。

匯入器使用獨立advisory transaction lock及自然鍵去重，不等同網站／備份共用鎖。搬機一致備份前暫停timer並確認執行中service已結束。FindMy/new_reports時間為UTC naive，不能按台北時間重解讀。

先驗證依賴與Apple session、取報告，再核對兩表寫入／去重、頁面讀取與空資料。服務範本存在不表示排程已啟用。本次文件更新不重新Apple登入或寫正式定位資料。完整搬機見[STANDALONE](STANDALONE.md)。
