import { describe, it, expect } from "vitest";
import { encryptLocalExport, decryptLocalExport } from "@/lib/localRecovery";
import { safeCsvCell } from "@/lib/reportSnapshot";
describe("protected recovery and exports", () => {
  it("encrypts and authenticates an export with a separate salt and IV", async () => {
    const original = JSON.stringify({
        scanId: crypto.randomUUID(),
        records: ["datos sintéticos"],
      }),
      password = "test-only-recovery-password";
    const encrypted = await encryptLocalExport(original, password);
    expect(encrypted).not.toContain("datos sintéticos");
    expect(await decryptLocalExport(encrypted, password)).toBe(original);
    await expect(
      decryptLocalExport(encrypted, password + "wrong"),
    ).rejects.toThrow("integridad");
    const changed = JSON.parse(encrypted);
    changed.ciphertext = "AAAA" + changed.ciphertext.slice(4);
    await expect(
      decryptLocalExport(JSON.stringify(changed), password),
    ).rejects.toThrow("integridad");
  }, 10000);
  it.each([
    '=HYPERLINK("https://example.invalid")',
    " +1+2",
    "@SUM(1)",
    "-1+3",
    "\t=1",
  ])("neutralizes spreadsheet formulas %s", (value) => {
    expect(safeCsvCell(value)).toMatch(/^"'/);
  });
  it("preserves ordinary names and escapes CSV quotes", () => {
    expect(safeCsvCell('María "Luz"')).toBe('"María ""Luz"""');
  });
});
