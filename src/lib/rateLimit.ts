import type { PoolClient } from "pg";
import { ApiProblem } from "./apiProblem";
export async function rateLimit(
  c: Pick<PoolClient, "query">,
  key: string,
  maximum: number,
  seconds = 60,
) {
  const { rows } = await c.query(
    `INSERT INTO login_limits(key,attempts,reset_at) VALUES($1,1,now()+$2*interval '1 second') ON CONFLICT(key) DO UPDATE SET
 attempts=CASE WHEN login_limits.reset_at<now() THEN 1 ELSE login_limits.attempts+1 END,
 reset_at=CASE WHEN login_limits.reset_at<now() THEN now()+$2*interval '1 second' ELSE login_limits.reset_at END RETURNING attempts`,
    [key, seconds],
  );
  if (rows[0].attempts > maximum)
    throw new ApiProblem(
      429,
      "RATE_LIMITED",
      "Se alcanzó el límite temporal. Conserva los datos y vuelve a intentar en un minuto.",
    );
}
