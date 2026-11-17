import { describe, it, expect } from "vitest";
import { evaluateCapture, schoolDate, schoolSeconds } from "@/lib/schoolClock";
const at = (time: string) => `2026-11-16T${time}-05:00`;
const base = {
  occurredAt: at("07:10:00"),
  receivedAt: at("07:10:01"),
  direction: "ENTRY" as const,
  start: "07:00:00",
  end: "13:00:00",
  grace: 10,
  teaching: true,
  burst: false,
};
describe("school attendance policy", () => {
  it("uses Lima date across the UTC midnight boundary", () => {
    expect(schoolDate("2026-11-17T03:59:59Z")).toBe("2026-11-16");
    expect(schoolSeconds("2026-11-17T03:59:59Z")).toBe(
      22 * 3600 + 59 * 60 + 59,
    );
  });
  it("includes the exact grace boundary and marks the following second late", () => {
    expect(evaluateCapture(base)).toMatchObject({
      status: "ON_TIME",
      disposition: "ACCEPTED",
    });
    expect(
      evaluateCapture({ ...base, occurredAt: at("07:10:01") }),
    ).toMatchObject({ status: "LATE" });
  });
  it("classifies an early entry as entry and an explicit early exit as early leave", () => {
    expect(
      evaluateCapture({ ...base, occurredAt: at("06:40:00") }),
    ).toMatchObject({ status: "ON_TIME", disposition: "ACCEPTED" });
    expect(
      evaluateCapture({
        ...base,
        direction: "EXIT",
        occurredAt: at("12:00:00"),
        receivedAt: at("12:00:01"),
        previousEntry: at("07:00:00"),
      }),
    ).toMatchObject({ status: "EARLY_LEAVE", disposition: "ACCEPTED" });
  });
  it("keeps lateness based on capture time during delayed synchronization", () => {
    expect(
      evaluateCapture({ ...base, receivedAt: at("16:00:00") }),
    ).toMatchObject({ status: "ON_TIME", disposition: "ACCEPTED" });
  });
  it.each([
    { teaching: false, reason: "NON_TEACHING_DAY" },
    { burst: true, reason: "BURST_REVIEW" },
    {
      occurredAt: at("23:00:00"),
      receivedAt: at("23:00:01"),
      reason: "OUTSIDE_WINDOW",
    },
    { occurredAt: at("07:15:00"), reason: "CLOCK_FUTURE" },
    { direction: "EXIT", reason: "EXIT_WITHOUT_ENTRY" },
    { previousEntry: at("07:00:00"), reason: "ENTRY_ALREADY_RECORDED" },
  ])("preserves exceptions for review: $reason", ({ reason, ...overrides }) => {
    expect(
      evaluateCapture({ ...base, ...overrides } as typeof base),
    ).toMatchObject({ disposition: "REVIEW", reason });
  });
});
