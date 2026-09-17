import assert from "node:assert/strict";
import test from "node:test";
import { formatConfigurationFiles, formatFrameworks, formatLanguageStatistics } from "../services/overviewMetadata.js";

test("formats language statistics from core metadata without recalculating them", () => {
  assert.equal(
    formatLanguageStatistics([
      { language: "TypeScript", fileCount: 3, percentage: 33.3 },
      { language: "Python", fileCount: 1, percentage: 11.1 },
    ]),
    "TypeScript 3 files (33.3%) · Python 1 file (11.1%)",
  );
});

test("deduplicates frameworks across projects", () => {
  assert.equal(
    formatFrameworks([
      { type: "Node.js", framework: "React", packageManager: "npm" },
      { type: "Node.js", framework: "Express", packageManager: "npm" },
      { type: "Node.js", framework: "React", packageManager: "npm" },
    ]),
    "React · Express",
  );
});

test("reports no framework when none is detected", () => {
  assert.equal(formatFrameworks([{ type: "Node.js", packageManager: "npm" }]), "None detected");
});

test("surfaces configuration files and truncates long lists", () => {
  assert.equal(formatConfigurationFiles(["package.json", "tsconfig.json"]), "package.json · tsconfig.json");
  assert.equal(
    formatConfigurationFiles(["a", "b", "c", "d"], 2),
    "a · b · +2 more",
  );
});
