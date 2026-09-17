import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { FileRepositoryScanner, detectLanguageStatistics } from "../analysis/repositoryScanner.js";

async function withFixture(files: Record<string, string>, excluded = ["node_modules/ignored.ts", "dist/generated.js"]): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "repolens-"));
  for (const [relativePath, content] of Object.entries({ ...files, ...Object.fromEntries(excluded.map((file) => [file, "ignored"])) })) {
    const target = path.join(root, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return root;
}

test("discovers nested files and directories while excluding generated/dependency directories", async () => {
  const root = await withFixture({
    "src/components/Button.tsx": "export const Button = () => null;",
    "src/services/api.ts": "export const api = {};",
    "package.json": "{}",
    "README.md": "# RepoLens",
  });

  try {
    const metadata = await new FileRepositoryScanner({ warn: () => undefined }).scan(root);
    assert.equal(metadata.files.length, 4);
    assert.ok(metadata.files.some((file) => file.relativePath === "src/components/Button.tsx"));
    assert.ok(metadata.directories.some((directory) => directory.relativePath === "src/components"));
    assert.ok(!metadata.files.some((file) => file.relativePath.startsWith("node_modules/")));
    assert.ok(!metadata.files.some((file) => file.relativePath.startsWith("dist/")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("detects supported languages and ignores unknown extensions", () => {
  const languages = detectLanguageStatistics([
    { path: "a.ts", relativePath: "a.ts", name: "a.ts", extension: ".ts" },
    { path: "b.py", relativePath: "b.py", name: "b.py", extension: ".py" },
    { path: "c.unknown", relativePath: "c.unknown", name: "c.unknown", extension: ".unknown" },
  ]);
  assert.deepEqual(languages, [
    { language: "Python", fileCount: 1, percentage: 50 },
    { language: "TypeScript", fileCount: 1, percentage: 50 },
  ]);
});

test("detects multiple ecosystems, package managers, frameworks, and config files", async () => {
  const root = await withFixture({
    "package.json": JSON.stringify({ dependencies: { react: "^18", next: "^14" } }),
    "pnpm-lock.yaml": "lockfileVersion: '9.0'",
    "pyproject.toml": "[project]\ndependencies = ['django>=5']",
    "Cargo.toml": "[package]\nname = 'fixture'",
    "tsconfig.json": "{}",
    ".github/workflows/ci.yml": "name: CI",
    ".env": "SECRET=do-not-expose",
  });

  try {
    const metadata = await new FileRepositoryScanner({ warn: () => undefined }).scan(root);
    assert.deepEqual(metadata.projects, [
      { type: "Node.js", framework: "Next.js, React", packageManager: "pnpm" },
      { type: "Python", framework: "Django" },
      { type: "Rust", packageManager: "Cargo" },
    ]);
    assert.ok(metadata.configFiles.includes("package.json"));
    assert.ok(metadata.configFiles.includes(".github/workflows/ci.yml"));
    assert.ok(!metadata.files.some((file) => file.name === ".env"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("does not follow directory symlinks", async () => {
  const root = await withFixture({ "src/index.ts": "export {};" });
  const outside = await mkdtemp(path.join(os.tmpdir(), "repolens-outside-"));
  try {
    await writeFile(path.join(outside, "secret.ts"), "export const secret = true;");
    await symlink(outside, path.join(root, "linked"), "junction");
    const metadata = await new FileRepositoryScanner({ warn: () => undefined }).scan(root);
    assert.ok(!metadata.files.some((file) => file.relativePath.startsWith("linked/")));
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
