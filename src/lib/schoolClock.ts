export const SCHOOL_ZONE = "America/Lima";
export function schoolDate(at: Date | string = new Date(), zone = SCHOOL_ZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(at));
}
export function schoolSeconds(at: Date | string, zone = SCHOOL_ZONE) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(at));
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return Number(v.hour) * 3600 + Number(v.minute) * 60 + Number(v.second);
}
export function timeSeconds(time: string) {
  const [h, m, s = 0] = time.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}
export function weekday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}
export function evaluateCapture(input: {
  occurredAt: string;
  receivedAt: string;
  direction: "ENTRY" | "EXIT";
  start: string;
  end: string;
  grace: number;
  teaching: boolean;
  previousEntry?: string | null;
  previousExit?: string | null;
  burst: boolean;
}) {
  const seconds = schoolSeconds(input.occurredAt);
  const start = timeSeconds(input.start),
    end = timeSeconds(input.end);
  let reason: string | null = null;
  if (
    new Date(input.occurredAt).getTime() >
    new Date(input.receivedAt).getTime() + 120000
  )
    reason = "CLOCK_FUTURE";
  else if (
    new Date(input.occurredAt).getTime() <
    new Date(input.receivedAt).getTime() - 72 * 3600000
  )
    reason = "OFFLINE_TOO_OLD";
  else if (!input.teaching) reason = "NON_TEACHING_DAY";
  else if (seconds < start - 3600 || seconds > end + 3 * 3600)
    reason = "OUTSIDE_WINDOW";
  else if (input.burst) reason = "BURST_REVIEW";
  else if (input.direction === "EXIT" && !input.previousEntry)
    reason = "EXIT_WITHOUT_ENTRY";
  else if (input.direction === "ENTRY" && input.previousEntry)
    reason = "ENTRY_ALREADY_RECORDED";
  else if (input.direction === "EXIT" && input.previousExit)
    reason = "EXIT_ALREADY_RECORDED";
  else if (
    input.previousEntry &&
    new Date(input.occurredAt) < new Date(input.previousEntry)
  )
    reason = "AMBIGUOUS_SEQUENCE";
  const status =
    input.direction === "ENTRY"
      ? seconds <= start + input.grace * 60
        ? "ON_TIME"
        : "LATE"
      : seconds < end
        ? "EARLY_LEAVE"
        : "EXIT";
  return {
    disposition: reason ? "REVIEW" : "ACCEPTED",
    reason,
    status,
  } as const;
}
