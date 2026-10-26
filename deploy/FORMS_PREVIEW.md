# 借用表單預覽與部署補充

接續欄位修正：A／E新增及編輯表單移除原表沒有的「申請緣由」。送出時以使用需求／類別補足現行API所需title；舊單保留原title，不需要SQL、API或套件更新。重建並發布dist後重新整理預覽即可。規則與驗證見 [FORM_FIELD_CORRECTION](../docs/reconstruction/FORM_FIELD_CORRECTION.md)。

本批為既有專案的React表單重建。布局見 [FORM_LAYOUT_SPEC](../docs/reconstruction/FORM_LAYOUT_SPEC.md)，檢查／截圖見 [FORM_ACCEPTANCE](../docs/reconstruction/FORM_ACCEPTANCE.md)。主畫面預覽文件仍適用。

## 可操作隔離預覽

在專案目錄執行：

```bash
npm run build
npm run preview:forms
```

預設監聽`0.0.0.0:18025`，瀏覽器開`http://localhost:18025/`；其他主機用這台主機的IP。可用`AMS_PREVIEW_PORT`指定空埠。此命令固定demo模式、兩個資料路徑皆設`.preview/borrowing-forms`、禁用正式資料庫URL及外部選項／政策檔；不使用正式SSO與既有正式資料目錄。

選示範管理員登入，再從以下路由操作：

| 畫面 | 路由／入口 |
| --- | --- |
| A | `/bookings/new/A` |
| D | `/bookings/new/D` |
| E | `/bookings/new/E` |
| B/C | 保存A後，父單詳情按發車、發車抵達、還車、還車抵達 |
| 編輯主表 | 借用詳情按編輯；A未發車才可重新排預約 |
| 編輯B/C | 詳情階段分頁 → 查看／修正此階段 |

每個明細／時段先按新增、填寫、保存，才送出整張表單。取消列不寫資料；表單取消前若有未保存内容會提示。E設備名稱選擇带入編碼與位置；時段可選實際設備。

B/C的「儲存草稿」為目前分頁的sessionStorage；24小時內同身份、父表狀態與revision重開可載入。草稿不發送通知、不推進流程、不跨裝置。照片上傳成功後要提交表單才能在紀錄中引用；本地移除不刪伺服器檔案。

結束預覽用Ctrl+C；`.preview`已忽略於Git，資料可保留供下次檢視。18024主畫面预覽、正式5173/5174各自獨立，不因本命令改部署設定。

## 隔離驗證

```bash
npm run check
npm run build
npm run test:forms
npm run test:calendar
npm run test:browser
npm run test:api
.venv/bin/python -m unittest discover -s tests -p 'test_form_compatibility.py'
.venv/bin/python -m unittest discover -s tests -p 'test_manual_people.py'
.venv/bin/python -m unittest discover -s tests -p 'test_departure_access.py'
```

forms、calendar及browser测试各自建立一次性資料與不同埠，結束移除資料，不連正式DB。`test:forms`寫截图及結果至`test-results/forms`；交付副本在`docs/reconstruction/screenshots/forms`。Chromium需依主機準備Playwright與系統函式庫；目前主機的缓存函式庫只是測試工具，網站啟動不依賴它。

## 正式部署

沿用 [部署說明](README.md)、[獨立搬機說明](STANDALONE.md) 的PostgreSQL／PostGIS、SSO、權限快照、資料與附件路徑。前端無Form.io、原專案或研究資料執行依賴；`forms.css`包含自行撰寫的样式。

本批不需要新增SQL表或資料搬移；新增程式`backend/form_validation.py`及更新的舊欄位編碼需与其餘backend一起交付。正式服務需載入更新後的Python程式；僅替換dist不能帶入這些驗證與相容修正。套用既有備份／重啟流程後另驗正式SSO、真實選項、D資源與舊表單／附件。

本次隔離驗證不表示已重新部署正式服務，也不等同實際企業登入與資料庫全流程驗收。
