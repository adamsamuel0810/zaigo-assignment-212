import { describe, expect, it } from "vitest";
import {
  getBulletParagraphs,
  isActualBulletParagraph,
} from "@/lib/rules/run-style";
import { ParagraphMetadata } from "@/lib/types";

describe("getBulletParagraphs", () => {
  it("excludes plain level-0 text without bullets", () => {
    const slide = {
      texts: [
        {
          paragraphs: [
            {
              level: 0,
              text: "Author line",
              runs: [],
              bullet_char: null,
            } as ParagraphMetadata,
            {
              level: 0,
              text: "Bullet item",
              runs: [],
              bullet_char: "▪",
            } as ParagraphMetadata,
          ],
        },
      ],
    };
    const bullets = getBulletParagraphs(slide);
    expect(bullets).toHaveLength(1);
    expect(bullets[0].text).toBe("Bullet item");
  });

  it("includes level 1+ paragraphs", () => {
    const p = {
      level: 1,
      text: "Sub bullet",
      runs: [],
      bullet_char: null,
    } as ParagraphMetadata;
    expect(isActualBulletParagraph(p)).toBe(true);
  });
});
