import { spawn } from "node:child_process";
import { loadLocalEnv } from "./local-env.mjs";
import { configuredPublicOrigin } from "../src/lib/publicOrigin.ts";

loadLocalEnv();
process.env.NODE_ENV = "production";
const port = process.env.PORT || "3000";
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
  throw new Error("PORT must be an integer between 1 and 65535.");
if ((process.env.JWT_SECRET?.length || 0) < 32)
  throw new Error(
    "JWT_SECRET requires at least 32 independently generated characters.",
  );
if (process.env.MIGRATION_DATABASE_URL)
  throw new Error(
    "Keep maintenance credentials outside the web service environment.",
  );
const origin = configuredPublicOrigin();
if (process.env.RAILWAY_ENVIRONMENT_ID && !origin)
  throw new Error(
    "Set SCA_PUBLIC_ORIGIN to the HTTPS origin assigned to the web service.",
  );
if (
  process.env.SCA_DEMO_MODE !== "true" &&
  (!process.env.DATABASE_URL || !process.env.SCA_SCHOOL_ID)
)
  throw new Error(
    "Institutional mode requires DATABASE_URL and SCA_SCHOOL_ID.",
  );

const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "0.0.0.0",
    "--port",
    port,
  ],
  { stdio: "inherit", env: process.env },
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => server.kill(signal));
server.on("error", () => {
  console.error("PRODUCTION_SERVER_START_FAILED");
  process.exitCode = 1;
});
server.on("exit", (code, signal) =>
  process.exit(code ?? (signal === "SIGTERM" || signal === "SIGINT" ? 0 : 1)),
);
