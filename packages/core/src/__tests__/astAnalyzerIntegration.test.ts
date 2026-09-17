import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { TypeScriptSourceAnalyzer } from "../analysis/astAnalyzer.js";
import { FileRepositoryScanner } from "../analysis/repositoryScanner.js";

test("analyzes only source files discovered by the Phase 1 scanner", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "repolens-integration-"));
  try {
    await mkdir(path.join(root, "src"), { recursive: true });
    await mkdir(path.join(root, "node_modules"), { recursive: true });
    await writeFile(path.join(root, "src", "index.ts"), "export const visible = true;", "utf8");
    await writeFile(path.join(root, "node_modules", "ignored.ts"), "export const hidden = true;", "utf8");
    await writeFile(path.join(root, "README.md"), "# fixture", "utf8");

    const metadata = await new FileRepositoryScanner({ warn: () => undefined }).scan(root);
    const analyses = await new TypeScriptSourceAnalyzer({ warn: () => undefined }).analyze(metadata.files);

    assert.deepEqual(analyses.map(({ filePath }) => filePath), ["src/index.ts"]);
    assert.equal(analyses[0]?.symbols[0]?.name, "visible");
    assert.ok(!analyses.some(({ filePath }) => filePath.includes("node_modules")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
