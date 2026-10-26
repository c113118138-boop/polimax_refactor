# polimax_refactor 時序圖

> 專案名稱與路徑更新：2026-10-07。專案名稱為 `polimax_refactor`，本機目錄為 `/home/c113118138/polimax_refactor`。

> 更新：2026-10-05。現行正式架構為 PostgreSQL／PostGIS + FastAPI + React + 公司 SSO。文件更新依程式與部署紀錄核對，未重新執行正式環境驗收。

從登入頁開始的詳細流程，請見 [逐步時序圖](SYSTEM_MAINTENANCE_GUIDE.md#flows)。

依目前正式 PostgreSQL／SSO 模式的原始碼整理，不含隔離 demo 模式。箭頭代表請求或內部呼叫，虛線代表回應；圖中省略部分欄位與 UI 操作。所有受保護 API 都會驗證 session，並依端點檢查權限。

## 1. SSO 登入

```mermaid
sequenceDiagram
    actor U as 使用者
    participant F as React 前端／瀏覽器
    participant A as FastAPI／SSO
    participant I as 公司 SSO
    participant L as 本地 session 與 AMS 權限快照
    U->>F: 開啟網站
    F->>A: GET /api/auth/me
    A-->>F: 401（未登入）
    F->>A: GET /api/auth/config
    A-->>F: SSO 設定
    U->>F: 點選公司 SSO 登入
    F->>A: GET /api/auth/sso?return_to=...
    A->>L: 保存一次性 state（10 分鐘）
    A-->>F: 設定 state cookie，導向 SSO 授權頁
    F->>I: 開啟授權頁並登入
    I-->>F: 導回 callback，攜帶 code 與 state
    F->>A: GET /api/callback?code=...&state=...
    A->>L: 驗證 cookie、消耗 state 並檢查期限
    A->>I: 以 authorization_code 交換 token
    I-->>A: access_token／refresh_token
    A->>I: GET /userinfo
    I-->>A: 使用者身分
    A->>L: 驗證啟用帳號、套用角色權限
    A->>L: 保存 token 與 12 小時 session
    A-->>F: 設定 HttpOnly session cookie，303 導回原頁
    F->>A: GET /api/auth/me
    A->>L: 讀取 session 與有效權限
    A-->>F: 使用者與權限
    F-->>U: 顯示工作空間
```

Token 僅保存在後端。受保護請求距離上次驗證超過 60 秒時，後端再次呼叫 `/userinfo`；若回傳 401 且有 refresh token，則嘗試刷新，失敗時要求重新登入。非正式主機進入登入端點時會先導向設定的正式主機。

## 2. 查詢日曆與預約

```mermaid
sequenceDiagram
    actor U as 使用者
    participant F as React／React Query
    participant A as FastAPI
    participant R as Store／Repository
    participant D as 既有 PostgreSQL
    participant J as 專案持久 JSON 表單
    U->>F: 開啟預約日曆
    par 資源查詢
        F->>A: GET /api/resources
        A->>R: 查詢可用資源
        R->>D: 讀取車輛、儀器等既有資料
        R-->>A: 資源資料
        A-->>F: 依權限過濾的資源
    and 預約查詢
        F->>A: GET /api/bookings
        A->>R: bookings()
        R->>D: 讀取 formio_responses、form_flows
        R->>J: 讀取完整表單內容
        R-->>A: 整合預約、時段與狀態
        A-->>F: 依表單與欄位權限過濾的預約
    end
    F-->>U: 顯示日曆與資源時段
    U->>F: 開啟預約明細
    F->>A: GET /api/bookings/{fid}
    A->>R: detail(fid)
    R->>D: 讀取預約與流程
    R->>J: 讀取 A/D/E 表單、相關 B/C 紀錄及版本
    R-->>A: 明細、出回程與歷史
    A->>A: 檢查讀取及擁有者權限、遮蔽欄位
    A-->>F: 預約明細
    F-->>U: 顯示明細
```

日曆另有假日查詢；掛載約兩秒後會呼叫通知檢查，正式 API 回覆 409（由既有程序處理），前端忽略此錯誤。以上聚焦主要資料讀取。

## 3. 新增／修改預約（A 車輛、D 作業區、E 儀器）

```mermaid
sequenceDiagram
    actor U as 使用者
    participant F as BookingForm
    participant A as FastAPI
    participant R as Store／Repository
    participant D as 既有 PostgreSQL
    participant J as 專案持久 JSON 表單
    U->>F: 填寫表單並送出
    F->>F: 檢查欄位、時間與明細
    F->>A: POST /api/bookings 或 PUT /api/bookings/{fid}
    A->>A: 驗證 session
    Note over A,R: 新增先檢查 create／submit；修改在鎖內讀取舊資料後檢查 write／擁有者／欄位權限
    A->>R: 開啟寫入 session
    R->>D: pg_try_advisory_lock 輪詢（最多 15 秒）
    R->>D: 讀取資源、既有預約與重疊時段
    R->>R: 驗證 revision、表單內容與時段衝突
    alt 權限、版本、時段或欄位驗證失敗
        R->>D: ROLLBACK，釋放已取得的鎖
        A-->>F: 403／409／422 與錯誤訊息
        F-->>U: 顯示錯誤並保留輸入
    else 驗證通過
        R->>R: 決定表單編號、準備 JSON 內容
        Note over R,D: 修改 A 建立新編號；修改 D/E 沿用編號；舊 SQL 明細標記取消
        R->>D: 寫入 formio_responses；A 另寫入 form_flows
        R->>J: 寫暫存檔、備份既有檔、原子替換
        alt 檔案寫入與 SQL 提交成功
            R->>D: COMMIT
            R->>D: pg_advisory_unlock
            R-->>A: 儲存結果
            A-->>F: 預約 id 與內容
            F->>F: invalidate() 使資料查詢失效
            F->>A: 導向明細頁後 GET /api/bookings/{id}
            A-->>F: 最新明細
            F-->>U: 顯示儲存成功
        else 檔案寫入或 SQL 提交失敗
            R->>D: ROLLBACK
            R->>J: 還原已替換的檔案
            R->>D: pg_advisory_unlock
            A-->>F: 錯誤訊息
            F-->>U: 顯示儲存失敗
        end
    end
```

前端直接送出新增／修改請求，沒有先呼叫 `/api/bookings/check`。衝突檢查在儲存鎖內執行，包含相接時間邊界。SQL 與檔案系統並非同一筆原子交易；上圖回復流程指程式可捕捉的正常錯誤。

## 4. 車輛出回程

```mermaid
sequenceDiagram
    actor U as 使用者
    participant F as 出回程表單
    participant A as FastAPI
    participant R as Store／Repository
    participant D as PostgreSQL form_flows
    participant J as B／C JSON 表單
    loop 每次提交下一階段，共四階段
        U->>F: 填寫駕駛、里程、時間等資料
        F->>A: POST /api/bookings/{fid}/advance<br/>content、expected_status、revision
        A->>R: 開啟寫入 session，取得 PostgreSQL session advisory lock
        R->>D: 讀取目前流程狀態
        A->>A: 檢查該階段操作及擁有者權限
        R->>R: 驗證版本、預期狀態、必填資料與里程
        alt 驗證失敗
            R->>D: 回滾並釋放鎖
            A-->>F: 403／409／422
            F-->>U: 顯示錯誤
        else 驗證通過
            Note over R,J: 發車建立 B；發車抵達更新 B<br/>回程建立 C；回程抵達更新 C
            R->>R: 準備 B 或 C 的 start／arrival 內容
            R->>D: 更新下一個狀態
            R->>J: 備份並原子替換 JSON
            R->>D: COMMIT，釋放鎖
            A-->>F: 更新後的預約
            F->>F: invalidate() 並更新畫面
            F-->>U: 顯示新狀態及下一階段入口
        end
    end
```

狀態順序：`PENDING`（已預約）→ `DEPARTURE`（已發車）→ `DEPARTURE_ARRIVED`（發車已抵達）→ `RETURN`（已開始回程）→ `RETURN_ARRIVED`（已完成）。儲存失敗的回滾方式同圖 3。

## 5. 附件上傳與讀取

```mermaid
sequenceDiagram
    actor U as 使用者
    participant F as React 前端
    participant A as FastAPI
    participant L as .data/files 原檔與metadata
    U->>F: 選擇附件或照片
    F->>A: POST /api/files，raw body與檔名標頭
    A->>A: 驗證登入、任一表單create與大小
    A->>L: UUID原檔串流寫入、fsync
    A->>L: 暫存metadata並原子替換uuid.json
    A-->>F: id/uuid/name/mime/size/owner
    F->>F: 保存附件到表單狀態
    F->>A: 另送表單，保存附件關聯
    U->>F: 預覽或下載
    F->>A: GET /api/files/{id}?preview=true
    A->>L: 檢查原檔與metadata
    alt 缺檔或索引
        A-->>F: 404
    else 檔案完整
        A-->>F: FileResponse，安全圖片inline／其他attachment
    end
```

一般附件10MiB、stage-photo1GiB。超限413、檔案I/O失敗503；上傳失敗清理原檔。沒有外部附件服務、upload轉送或307fallback。

## 6. FindMy、封存與備份

```mermaid
sequenceDiagram
    participant T as systemd timer
    participant I as FindMy 匯入器
    participant U as Apple FindMy
    participant D as PostgreSQL正式庫
    participant R as 封存引擎
    participant X as PostgreSQL封存庫
    participant B as 備份工具
    T->>I: 每小時匯入
    I->>U: 用專案Apple session取得報告
    U-->>I: UTC定位回報
    I->>D: 去重交易寫FindMy與new_reports
    T->>R: 每日03:30封存
    R->>D: 取得共用鎖、篩選與鎖定來源
    R->>X: 保存原列、JSON、附件區塊並提交
    R->>X: 新交易讀回驗證
    R->>D: 再核對來源相同才刪除並提交
    T->>B: 每日04:00備份（依主機時區）
    B->>D: 共用應用鎖與正式dump
    B->>X: 封存啟用時產生封存dump
    B->>B: 打包持久資料、寫SHA-256 manifest
```

跨庫不是單一交易；缺檔、內容不符保留來源。備份應用鎖不涵蓋全部外部接收器；跨系統搬機要停所有寫入者。

## 程式依據

- `src/App.tsx`、`src/api.ts`：登入、session 查詢、API 包裝與查詢更新。
- `src/Calendar.tsx`、`src/Bookings.tsx`：日曆、預約查詢與送出。
- `src/Stages.tsx`：出回程送出。
- `backend/sso.py`：SSO、state、session、權限與 token 刷新。
- `backend/legacy_api.py`：正式 API、權限與本機附件保存與下載。
- `backend/legacy_store.py`：PostgreSQL／JSON 整合、advisory lock、交易與狀態轉換。
