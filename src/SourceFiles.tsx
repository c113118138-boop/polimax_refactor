import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { ErrorBox, Loading, Modal } from "./ui";

function FilePreview({ file, close }: { file: any; close: () => void }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  const supported = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
  ].includes(file.mime);
  useEffect(() => {
    if (!supported) return;
    let current = true,
      objectUrl = "";
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(
          "/api/files/" + file.id + "?preview=true",
          { signal: controller.signal },
        );
        if (!response.ok)
          throw new Error((await response.json()).detail || "無法讀取附件");
        objectUrl = URL.createObjectURL(await response.blob());
        if (current) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      } catch (e) {
        if (current) setError((e as Error).message);
      }
    })();
    return () => {
      current = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id]);
  return (
    <Modal
      open
      title={"預覽：" + file.name}
      wide
      className="source-file-preview"
      onClose={close}
    >
      <ErrorBox error={error} />
      {supported && !url && !error && <Loading />}
      {url &&
        (file.mime === "application/pdf" ? (
          <iframe src={url} title={file.name} />
        ) : (
          <img src={url} alt={file.name} />
        ))}
      {!supported && <p>此檔案格式請下載後開啟。</p>}
      <div className="actions">
        <a
          className="button primary"
          href={"/api/files/" + file.id}
          download={file.name}
        >
          下載
        </a>
        <button className="button" onClick={close}>
          關閉預覽
        </button>
      </div>
    </Modal>
  );
}

export function SourceFiles({ files = [] }: { files?: any[] }) {
  const [selected, setSelected] = useState(0),
    [preview, setPreview] = useState<any>();
  const file = files[Math.min(selected, Math.max(0, files.length - 1))];
  if (!file) return <span>無附件</span>;
  return (
    <div className="attachments source-file-controls">
      {files.length > 1 && (
        <select
          aria-label="選擇附件"
          value={Math.min(selected, files.length - 1)}
          onChange={(e) => setSelected(Number(e.target.value))}
        >
          {files.map((f, i) => (
            <option key={f.id || i} value={i}>
              {f.name}
            </option>
          ))}
        </select>
      )}
      <div className="file-row">
        <a href={"/api/files/" + file.id} download={file.name}>
          {file.name}
        </a>
        <button
          className="icon-button"
          aria-label={"預覽：" + file.name}
          title={"預覽：" + file.name}
          onClick={() => setPreview(file)}
        >
          <Eye size={18} />
        </button>
      </div>
      {preview && (
        <FilePreview file={preview} close={() => setPreview(undefined)} />
      )}
    </div>
  );
}
