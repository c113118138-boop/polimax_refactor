import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const project = new URL("../", import.meta.url).pathname;
const data = resolve(project, ".preview/borrowing-forms");
await mkdir(data, { recursive: true });
const port = process.env.AMS_PREVIEW_PORT || "18025";
console.log(
  `借用表單隔離預覽：http://localhost:${port}/（示範登入；獨立資料）`,
);
const server = spawn(
  resolve(project, ".venv/bin/python"),
  [
    "-m",
    "uvicorn",
    "app:app",
    "--app-dir",
    resolve(project, "backend"),
    "--host",
    "0.0.0.0",
    "--port",
    port,
  ],
  {
    cwd: project,
    stdio: "inherit",
    env: {
      ...process.env,
      AMS_DATABASE_MODE: "demo",
      AMS_DATA_DIR: data,
      PREVIEW_DATA_DIR: data,
      PREVIEW_DATABASE_URL: "",
      PREVIEW_LOGIN_ENABLED: "1",
      AMS_POLICY_FILE: "",
      AMS_OPTIONS_FILE: "",
      AMS_HOLIDAYS_FILE: "",
      AMS_REPORTS_FILE: "",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 0));
