import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { TypeScriptSourceAnalyzer } from "../analysis/astAnalyzer.js";
import type { RepositoryFile } from "../types/repository.js";

async function withFiles(files: Record<string, string>): Promise<{ root: string; repositoryFiles: RepositoryFile[] }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "repolens-ast-"));
  const repositoryFiles: RepositoryFile[] = [];

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    await writeFile(filePath, content, "utf8");
    repositoryFiles.push({
      path: filePath,
      relativePath,
      name: path.basename(relativePath),
      extension: path.extname(relativePath),
    });
  }

  return { root, repositoryFiles };
}

test("extracts functions, arrow functions, and source locations", async () => {
  const { root, repositoryFiles } = await withFiles({
    "src/greet.ts": "function greet(name: string) {\n  return `Hello ${name}`;\n}\n\nconst format = () => name;",
  });

  try {
    const [analysis] = await new TypeScriptSourceAnalyzer({ warn: () => undefined }).analyze(repositoryFiles);
    assert.ok(analysis);
    assert.deepEqual(
      analysis.symbols.map(({ name, kind }) => ({ name, kind })),
      [
        { name: "greet", kind: "function" },
        { name: "format", kind: "function" },
      ],
    );
    assert.deepEqual(analysis.symbols[0], {
      name: "greet",
      kind: "function",
      filePath: "src/greet.ts",
      line: 1,
      column: 1,
      exported: false,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("extracts classes, properties, constructors, and methods with export status", async () => {
  const { root, repositoryFiles } = await withFiles({
    "user.ts": "export class User {\n  name: string;\n\n  constructor(name: string) {\n    this.name = name;\n  }\n\n  getName() {\n    return this.name;\n  }\n}",
  });

  try {
    const [analysis] = await new TypeScriptSourceAnalyzer({ warn: () => undefined }).analyze(repositoryFiles);
    assert.ok(analysis);
    assert.deepEqual(
      analysis.symbols.map(({ name, kind, exported }) => ({ name, kind, exported })),
      [
        { name: "User", kind: "class", exported: true },
        { name: "name", kind: "property", exported: false },
        { name: "constructor", kind: "constructor", exported: false },
        { name: "getName", kind: "method", exported: false },
      ],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("extracts interfaces, type aliases, enums, and exported variables", async () => {
  const { root, repositoryFiles } = await withFiles({
    "models.ts": "export interface UserData { id: string; }\ntype UserId = string;\nexport const value = 1;\nenum Role { Admin, User }",
  });

  try {
    const [analysis] = await new TypeScriptSourceAnalyzer({ warn: () => undefined }).analyze(repositoryFiles);
    assert.ok(analysis);
    assert.deepEqual(
      analysis.symbols.map(({ name, kind, exported }) => ({ name, kind, exported })),
      [
        { name: "UserData", kind: "interface", exported: true },
        { name: "UserId", kind: "type", exported: false },
        { name: "value", kind: "variable", exported: true },
        { name: "Role", kind: "enum", exported: false },
      ],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("extracts default, named, and namespace imports", async () => {
  const { root, repositoryFiles } = await withFiles({
    "imports.ts": "import React from \"react\";\nimport { foo, bar as baz } from \"./foo\";\nimport * as utils from \"../utils\";",
  });

  try {
    const [analysis] = await new TypeScriptSourceAnalyzer({ warn: () => undefined }).analyze(repositoryFiles);
    assert.ok(analysis);
    assert.deepEqual(analysis.imports, [
      { source: "react", importedNames: [{ importedName: "default", localName: "React" }] },
      {
        source: "./foo",
        importedNames: [
          { importedName: "foo" },
          { importedName: "bar", localName: "baz" },
        ],
      },
      { source: "../utils", importedNames: [{ importedName: "*", localName: "utils" }] },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("extracts declaration and re-export references", async () => {
  const { root, repositoryFiles } = await withFiles({
    "exports.ts": "export function foo() {}\nconst bar = 1;\nexport { bar };\nexport { baz } from \"./other\";",
  });

  try {
    const [analysis] = await new TypeScriptSourceAnalyzer({ warn: () => undefined }).analyze(repositoryFiles);
    assert.ok(analysis);
    assert.deepEqual(analysis.exports, [
      { name: "foo" },
      { name: "bar" },
      { name: "baz", source: "./other" },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("parses JavaScript, JSX, TSX, and skips unsupported languages", async () => {
  const { root, repositoryFiles } = await withFiles({
    "plain.js": "export function run() {}",
    "component.jsx": "export const Component = () => <div />;",
    "component.tsx": "export const App = () => <main />;",
    "script.py": "def run():\n    return True",
  });

  try {
    const analyses = await new TypeScriptSourceAnalyzer({ warn: () => undefined }).analyze(repositoryFiles);
    assert.equal(analyses.length, 3);
    assert.deepEqual(analyses.map(({ filePath, language }) => ({ filePath, language })), [
      { filePath: "plain.js", language: "javascript" },
      { filePath: "component.jsx", language: "javascript" },
      { filePath: "component.tsx", language: "typescript" },
    ]);
    assert.ok(analyses.every(({ error }) => !error));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("isolates malformed files and continues analyzing other source files", async () => {
  const { root, repositoryFiles } = await withFiles({
    "good.ts": "export const good = true;",
    "broken.ts": "export function broken( {",
  });

  try {
    const analyses = await new TypeScriptSourceAnalyzer({ warn: () => undefined }).analyze(repositoryFiles);
    const good = analyses.find(({ filePath }) => filePath === "good.ts");
    const broken = analyses.find(({ filePath }) => filePath === "broken.ts");
    assert.ok(good);
    assert.ok(broken);
    assert.equal(good.error, undefined);
    assert.ok(good.symbols.some(({ name }) => name === "good"));
    assert.equal(broken.symbols.length, 0);
    assert.ok(broken.error);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
