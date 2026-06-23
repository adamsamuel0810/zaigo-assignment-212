import { describe, expect, it } from "vitest";
import { resolve } from "path";
import { spawnSync } from "child_process";
import { runDeterministicRules } from "@/lib/rules/engine";
import { Finding, PresentationMetadata } from "@/lib/types";

let cached: PresentationMetadata | null = null;
let cachedFindings: Finding[] | null = null;

function findingsForDeck(): Finding[] {
  if (cachedFindings) return cachedFindings;
  cachedFindings = runDeterministicRules(parseGoofy());
  return cachedFindings;
}

function ruleIdsFor(slide: number): string[] {
  return findingsForDeck()
    .filter((f) => f.slide_number === slide)
    .map((f) => f.rule_id);
}

function parseGoofy(): PresentationMetadata {
  if (cached) return cached;
  const root = resolve(__dirname, "../..");
  const pptx = resolve(root, "../Goofy Corp Peer Group Assessment - ANNOTATED.pptx");
  const result = spawnSync("python", ["python/services/parse_cli.py", pptx], {
    cwd: root,
    env: { ...process.env, PYTHONPATH: root },
    encoding: "utf-8",
    maxBuffer: 50 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "parse failed");
  }
  cached = JSON.parse(result.stdout) as PresentationMetadata;
  return cached;
}

describe("Goofy annotated deck — calibration against ground-truth notes", () => {
  it(
    "matches the annotated issues without the previous false positives",
    () => {
      // Warm the cache once (parsing is the slow part).
      parseGoofy();

      // S1: only DRAFT, no inherited-style false positives.
      expect(ruleIdsFor(1)).toContain("TITLE_005");
      expect(ruleIdsFor(1)).not.toContain("TITLE_001");
      expect(ruleIdsFor(1)).not.toContain("COLOR_001");

      // S2: non-parallel bullets, no spacing false positives.
      expect(ruleIdsFor(2)).toContain("BULLET_005");
      expect(ruleIdsFor(2)).not.toContain("SPACING_001");
      expect(ruleIdsFor(2)).not.toContain("SPACING_002");

      // S3: long title, moved title, %ile, and inconsistent client name; no
      // sidebar bullet-size / spacing false positives.
      expect(ruleIdsFor(3)).toEqual(
        expect.arrayContaining([
          "TITLE_004",
          "TITLE_007",
          "TABLE_003",
          "TERM_003",
        ]),
      );
      expect(ruleIdsFor(3)).not.toContain("BULLET_001");
      expect(ruleIdsFor(3)).not.toContain("BULLET_002");
      expect(ruleIdsFor(3)).not.toContain("SPACING_001");

      // S4: moved title + inconsistent (8pt vs 10pt) table font size.
      expect(ruleIdsFor(4)).toEqual(
        expect.arrayContaining(["TITLE_007", "TABLE_008"]),
      );

      // S5: %ile + "Company Name"; legend swatch table no longer a fake header,
      // multi-row header no longer a fake stats/zebra issue.
      expect(ruleIdsFor(5)).toContain("TABLE_003");
      expect(ruleIdsFor(5)).not.toContain("TABLE_001");
      expect(ruleIdsFor(5)).not.toContain("TABLE_002");
      expect(ruleIdsFor(5)).not.toContain("TABLE_004");

      // S6: group-divider row shading is not flagged.
      expect(ruleIdsFor(6)).not.toContain("TABLE_002");

      // S8: near-palette header/text colors are within tolerance.
      expect(ruleIdsFor(8)).not.toContain("COLOR_001");
      expect(ruleIdsFor(8)).not.toContain("TABLE_001");

      // S9: 4-line title flagged.
      expect(ruleIdsFor(9)).toContain("TITLE_004");

      // Confidentiality removed on these slides.
      for (const n of [10, 13, 14, 23]) {
        expect(ruleIdsFor(n)).toContain("FOOTER_001");
      }

      // Key/Legend inconsistency on the minority "Legend" slides.
      for (const n of [10, 13, 14]) {
        expect(ruleIdsFor(n)).toContain("TERM_004");
      }

      // S11: footnote sits just above the footer but does not meaningfully
      // overlap it — must not be flagged.
      expect(ruleIdsFor(11)).not.toContain("FOOTER_004");

      // S12: "Company Name" terminology + footnote overlapping the footer.
      expect(ruleIdsFor(12)).toContain("TERM_002");
      expect(ruleIdsFor(12)).toContain("FOOTER_004");

      // S24: confidentiality moved from standard position.
      expect(ruleIdsFor(24)).toContain("FOOTER_003");

      // Slides annotated as clean must produce no findings.
      for (const n of [7, 15, 16, 17, 18, 19, 20, 21, 22]) {
        expect(ruleIdsFor(n)).toEqual([]);
      }
    },
    30_000,
  );
});
