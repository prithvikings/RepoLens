import test from "node:test";
import assert from "node:assert/strict";
import type { SourceFileAnalysis } from "@repolens/core";
import { formatAnalysisStatus, formatSymbolSummary } from "../services/overviewMetadata.js";

function analysis(symbols: SourceFileAnalysis["symbols"], imports = 0, exports = 0, error?: string): SourceFileAnalysis {
  return {
    filePath: "src/file.ts",
    language: "typescript",
    symbols,
    imports: Array.from({ length: imports }, () => ({ source: "./dependency", importedNames: [] })),
    exports: Array.from({ length: exports }, (_, index) => ({ name: `export${index}` })),
    ...(error ? { error } : {}),
  };
}

test("formats symbol counts by supported kind", () => {
  const result = formatSymbolSummary([
    analysis([
      { name: "foo", kind: "function", filePath: "src/file.ts", line: 1, column: 1, exported: true },
      { name: "User", kind: "class", filePath: "src/file.ts", line: 2, column: 1, exported: false },
      { name: "UserData", kind: "interface", filePath: "src/file.ts", line: 3, column: 1, exported: false },
    ]),
    analysis([
      { name: "bar", kind: "function", filePath: "src/other.ts", line: 1, column: 1, exported: false },
      { name: "id", kind: "property", filePath: "src/other.ts", line: 2, column: 3, exported: false },
    ]),
  ]);

  assert.deepEqual(result, ["Function 2", "Class 1", "Interface 1", "Property 1"]);
});

test("reports analysis errors without hiding successful files", () => {
  assert.equal(
    formatAnalysisStatus([
      analysis([], 1, 1),
      analysis([], 0, 0, "syntax error"),
    ]),
    "Analyzed with 1 error",
  );
});
