import { describe, it, expect } from "vitest";
import { buildShareLinks } from "../src/index";

const URL = "https://www.govjobpulse.com/jobs/technician-b";
const TITLE = "Recruitment to the post of Technician 'B'";

describe("buildShareLinks", () => {
  const links = buildShareLinks(URL, TITLE);

  it("builds a Facebook sharer URL with the encoded page URL", () => {
    expect(links.facebook).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(URL)}`
    );
  });

  it("builds a LinkedIn share-offsite URL with the encoded page URL", () => {
    expect(links.linkedin).toBe(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(URL)}`
    );
  });

  it("builds a Twitter intent URL with both url and text params", () => {
    expect(links.twitter).toContain(`url=${encodeURIComponent(URL)}`);
    expect(links.twitter).toContain(`text=${encodeURIComponent(TITLE)}`);
    expect(links.twitter.startsWith("https://twitter.com/intent/tweet?")).toBe(true);
  });

  it("builds a Telegram share URL with both url and text params", () => {
    expect(links.telegram).toContain(`url=${encodeURIComponent(URL)}`);
    expect(links.telegram).toContain(`text=${encodeURIComponent(TITLE)}`);
  });

  it("builds a WhatsApp URL with title and URL combined in a single text param", () => {
    expect(links.whatsapp).toBe(
      `https://wa.me/?text=${encodeURIComponent(`${TITLE} ${URL}`)}`
    );
  });

  it("properly encodes special characters in the title (quotes, spaces)", () => {
    const specialLinks = buildShareLinks(URL, "Technician 'B' & Draughtsman \"C\"");
    // If this weren't encoded, the resulting URL would be malformed —
    // decoding it back should exactly recover the original title.
    const textParam = specialLinks.twitter.split("text=")[1];
    expect(textParam).toBeDefined();
    const decodedFromTwitter = decodeURIComponent(textParam!);
    expect(decodedFromTwitter).toBe("Technician 'B' & Draughtsman \"C\"");
  });

  it("produces distinct URLs per platform (not accidentally the same link 5 times)", () => {
    const values = Object.values(links);
    expect(new Set(values).size).toBe(values.length);
  });
});
