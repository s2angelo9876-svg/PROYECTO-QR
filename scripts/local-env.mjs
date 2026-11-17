import { existsSync } from "node:fs";
export function loadLocalEnv({ maintenance = false } = {}) {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  if (maintenance && existsSync("var/maintenance.env"))
    process.loadEnvFile("var/maintenance.env");
}
