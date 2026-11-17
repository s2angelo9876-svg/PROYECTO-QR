import { describe, it, expect } from "vitest";
import { ReaderFrameParser } from "@/lib/serialReaders";
describe("independent reader channels", () => {
  it("preserves interleaved chunks from distinct ports without crossing frames", () => {
    const one: string[] = [],
      two: string[] = [],
      errors: string[] = [],
      a = new ReaderFrameParser(
        (v) => one.push(v),
        (e) => errors.push(e),
      ),
      b = new ReaderFrameParser(
        (v) => two.push(v),
        (e) => errors.push(e),
      );
    a.feed("SCA1:abc", 100);
    b.feed("SCA1:def", 101);
    a.feed(".signature\r", 102);
    b.feed(".signature\n", 103);
    expect(one).toEqual(["SCA1:abc.signature"]);
    expect(two).toEqual(["SCA1:def.signature"]);
    expect(errors).toEqual([]);
  });
  it("handles CRLF and clears expired or oversized frames", () => {
    const frames: string[] = [],
      errors: string[] = [],
      p = new ReaderFrameParser(
        (v) => frames.push(v),
        (e) => errors.push(e),
        20,
      );
    p.feed("first\r\nsecond\n", 100);
    p.feed("incomplete", 200);
    p.feed("new\n", 2500);
    p.feed("x".repeat(21), 2600);
    expect(frames).toEqual(["first", "second", "new"]);
    expect(errors).toHaveLength(2);
  });
});
