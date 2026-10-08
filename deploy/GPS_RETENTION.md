# PostgreSQL 定位保存與查詢

> 專案名稱與路徑更新：2026-10-07。專案名稱為 `polimax_refactor`，本機目錄為 `/home/c113118138/polimax_refactor`。

更新：2026-10-05。正式定位資料只使用PostgreSQL。清理已統一採[封存→驗證→刪除](ARCHIVE_RETENTION.md)，沒有MySQL清理、直接刪除或ensure-indexes操作。

## 查詢契約

最新車輛位置`GET /api/positions`：CarList.client_id對gps_readings.client_id，依record_time/id倒序取一筆；即使最後位置超過90天仍可供最新位置查詢，沒有結果回null與missing。此API只處理車輛。

軌跡`GET /api/trajectory/{rid}?start=...&end=...&limit=1000`：

- carMap.read；start必須早於end，單次跨度最多90天，過舊start裁切至目前減90天。
- 使用created_at接收時間，起含迄不含；record_time是裝置記錄時間。
- 數值latitude/longitude須在合法範圍，兩欄絕對值均>0.001。
- 依created_at/id排序，在資料庫抽樣保留首尾；limit預設1000、限制2..10000。
- 回points/count/total，total是有效原始筆數、count是實際回傳；長時段折線只是摘要。
- 地圖預設30天，提供30/60/90天及自訂；API讀數值欄位，不提供PostGIS來源選擇。

## 保留群組與時間

| 表 | 90天依據 | 最新資料例外 |
| --- | --- | --- |
| gps_readings | created_at，台北時間 | 每client_id最新record_time/id |
| new_reports | timestamp，UTC | 每sheet_id最新timestamp/id |
| Outdoor_Beacon_readings | created_at，台北時間 | 每client_id/major/minor最新created_at與record_time |
| FindMy | created_at，UTC | 每major最新timestamp與created_at |
| sensor_readings | created_at，台北時間 | 每client_id/major最新created_at與timestamp |

最新接收／記錄可能不同而保留多筆。NULL日期或設備識別不自動清理；缺表記錄並跳過。主檔CarList／EquipmentList／BeaconList不列入清理。

## 維運

以下預設只預覽有限批次，筆數不是全庫總數：

```bash
.venv/bin/python scripts/archive_maintenance.py
```

完成雙庫初始化、預覽及備份後，由已配置服務執行：

```bash
.venv/bin/python scripts/archive_maintenance.py --apply
systemctl --user status polimax-gps-cleanup.timer
journalctl --user -u polimax-gps-cleanup.service -n 100 --no-pager
```

`gps_maintenance.py`只是同一封存工具的相容入口，不存在另一套刪除邏輯。每日03:30 Asia/Taipei、Persistent；先提交封存、讀回驗證與核對來源才刪除。缺JSON／附件的業務資料留在正式庫；本地原檔不自動回收。

目前背景定位生產者包括外部MQTT接收器與[專案內FindMy匯入器](FINDMY_POSTGRESQL.md)。頁面刷新只讀資料庫，不會觸發上游採集。

## 驗證

```bash
.venv/bin/python tests/test_retention.py
npm run build
node tests/browser_location.mjs
```

retention測試使用臨時PostgreSQL16／PostGIS；地圖瀏覽器測試使用隔離demo與mock，需Chromium及系統函式庫。完整說明見[PostGIS](POSTGIS.md)。本次文件更新未重跑測試。
