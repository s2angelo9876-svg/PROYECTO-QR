import { spawn } from "node:child_process";
const child = spawn(
  process.execPath,
  ["node_modules/vitest/vitest.mjs", "run", "tests/integration"],
  { stdio: "inherit", env: { ...process.env, SCA_RUN_INTEGRATION: "true" } },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
