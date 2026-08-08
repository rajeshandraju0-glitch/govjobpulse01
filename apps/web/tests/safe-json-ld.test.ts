import { describe, it, expect } from "vitest";
import { safeJsonLdStringify } from "../lib/site";

describe("safeJsonLdStringify — XSS mitigation for JSON-LD <script> tags", () => {
  it("escapes a </script> sequence so it cannot break out of the script tag", () => {
    const malicious = { title: '</script><script>alert(1)</script>' };
    const output = safeJsonLdStringify(malicious);
    expect(output).not.toContain("</script>");
    expect(output).not.toContain("<script>");
  });

  it("produces output that, when parsed back, exactly recovers the original string", () => {
    const original = { title: "Technician 'B' & Draughtsman <C> </script>" };
    const output = safeJsonLdStringify(original);
    // The escaped \u003c/\u003e/\u0026 sequences are still valid JSON —
    // a browser's JSON.parse on this string must recover the exact
    // original value, proving this isn't corrupting real data, just
    // preventing HTML-tag interpretation.
    const parsed = JSON.parse(output);
    expect(parsed).toEqual(original);
  });

  it("escapes ampersands too, not just angle brackets", () => {
    const output = safeJsonLdStringify({ x: "Tom & Jerry" });
    expect(output).not.toContain("&");
    expect(JSON.parse(output)).toEqual({ x: "Tom & Jerry" });
  });

  it("does not affect normal, safe strings", () => {
    const safe = { title: "Recruitment to the post of Technician B", vacancies: 42 };
    const output = safeJsonLdStringify(safe);
    expect(JSON.parse(output)).toEqual(safe);
  });
});
