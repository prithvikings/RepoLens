import assert from "node:assert/strict";
import test from "node:test";
import { CodeGraphBuilder } from "../graph/codeGraphBuilder.js";
import type { SourceFileAnalysis } from "../types/symbol.js";

function analysis(
  filePath: string,
  symbols: SourceFileAnalysis["symbols"],
  imports: SourceFileAnalysis["imports"] = [],
  exports: SourceFileAnalysis["exports"] = [],
  error?: string,
): SourceFileAnalysis {
  return {
    filePath,
    language: filePath.endsWith(".js") || filePath.endsWith(".jsx") ? "javascript" : "typescript",
    symbols,
    imports,
    exports,
    ...(error ? { error } : {}),
  };
}

function symbol(
  filePath: string,
  name: string,
  kind: SourceFileAnalysis["symbols"][number]["kind"],
  line: number,
  column = 1,
  exported = false,
): SourceFileAnalysis["symbols"][number] {
  return { filePath, name, kind, line, column, exported };
}

function hasNode(graph: ReturnType<CodeGraphBuilder["build"]>, id: string): boolean {
  return graph.nodes.some((node) => node.id === id);
}

function hasEdge(graph: ReturnType<CodeGraphBuilder["build"]>, source: string, target: string, kind: string): boolean {
  return graph.edges.some((edge) => edge.source === source && edge.target === target && edge.kind === kind);
}

test("creates deterministic file nodes and symbol nodes", () => {
  const analyses = [
    analysis("src/user.ts", [
      symbol("src/user.ts", "User", "class", 1, 1, true),
      symbol("src/user.ts", "name", "property", 2, 3),
    ]),
    analysis("src/helpers.ts", [symbol("src/helpers.ts", "greet", "function", 1, 1, true)]),
  ];
  const graph = new CodeGraphBuilder().build(analyses);
  assert.ok(hasNode(graph, "file:src/user.ts"));
  assert.ok(hasNode(graph, "file:src/helpers.ts"));
  assert.ok(hasNode(graph, "symbol:src/user.ts:class:User:1:1"));
  assert.ok(hasNode(graph, "symbol:src/user.ts:property:name:2:3"));
  assert.ok(hasNode(graph, "symbol:src/helpers.ts:function:greet:1:1"));
});

test("creates file-to-symbol containment edges", () => {
  const analyses = [
    analysis("src/component.tsx", [
      symbol("src/component.tsx", "ComponentProps", "type", 3, 1, true),
      symbol("src/component.tsx", "UserComponent", "function", 7, 1, true),
    ]),
  ];
  const graph = new CodeGraphBuilder().build(analyses);
  assert.ok(hasEdge(graph, "file:src/component.tsx", "symbol:src/component.tsx:type:ComponentProps:3:1", "contains"));
  assert.ok(hasEdge(graph, "file:src/component.tsx", "symbol:src/component.tsx:function:UserComponent:7:1", "contains"));
});

test("resolves local extensionless imports to repository files", () => {
  const analyses = [
    analysis("src/component.tsx", [], [{ source: "./user", importedNames: [{ importedName: "User" }] }]),
    analysis("src/user.ts", []),
  ];
  const graph = new CodeGraphBuilder().build(analyses);
  assert.ok(hasEdge(graph, "file:src/component.tsx", "file:src/user.ts", "imports"));
  assert.equal(graph.edges.filter(({ kind }) => kind === "imports").length, 1);
});

test("creates export edges for local exported symbols", () => {
  const analyses = [
    analysis("src/user.ts", [symbol("src/user.ts", "User", "class", 1, 1, true)], [], [{ name: "User" }]),
    analysis("src/component.tsx", [
      symbol("src/component.tsx", "ComponentProps", "type", 1, 1, true),
      symbol("src/component.tsx", "UserComponent", "function", 2, 1, true),
    ], [], [{ name: "ComponentProps" }, { name: "UserComponent" }]),
  ];
  const graph = new CodeGraphBuilder().build(analyses);
  assert.ok(hasEdge(graph, "file:src/user.ts", "symbol:src/user.ts:class:User:1:1", "exports"));
  assert.ok(hasEdge(graph, "file:src/component.tsx", "symbol:src/component.tsx:type:ComponentProps:1:1", "exports"));
  assert.ok(hasEdge(graph, "file:src/component.tsx", "symbol:src/component.tsx:function:UserComponent:2:1", "exports"));
});

test("does not create nodes or edges for unresolved external imports", () => {
  const analyses = [
    analysis("src/app.ts", [], [
      { source: "react", importedNames: [{ importedName: "default", localName: "React" }] },
      { source: "express", importedNames: [{ importedName: "default", localName: "express" }] },
    ]),
  ];
  const graph = new CodeGraphBuilder().build(analyses);
  assert.equal(graph.nodes.length, 1);
  assert.equal(graph.nodes[0]?.id, "file:src/app.ts");
  assert.equal(graph.edges.length, 0);
});

test("produces identical graphs for repeated construction", () => {
  const analyses = [
    analysis("src/user.ts", [symbol("src/user.ts", "User", "class", 1, 1, true)]),
    analysis("src/component.tsx", [
      symbol("src/component.tsx", "UserComponent", "function", 3, 1, true),
    ], [{ source: "./user", importedNames: [{ importedName: "User" }] }], [{ name: "UserComponent" }]),
  ];
  const builder = new CodeGraphBuilder();
  const first = builder.build(analyses);
  const second = builder.build([...analyses].reverse());
  assert.deepEqual(second, first);
  assert.equal(new Set(first.nodes.map(({ id }) => id)).size, first.nodes.length);
  assert.equal(new Set(first.edges.map(({ id }) => id)).size, first.edges.length);
});

test("prevents duplicate nodes and identical edges", () => {
  const repeated = analysis("src/user.ts", [
    symbol("src/user.ts", "User", "class", 1, 1, true),
  ], [{ source: "./helpers", importedNames: [] }, { source: "./helpers", importedNames: [] }], [
    { name: "User" }, { name: "User" },
  ]);
  const analyses = [repeated, analysis("src/helpers.ts", [])];
  const graph = new CodeGraphBuilder().build(analyses);
  assert.equal(graph.nodes.filter(({ id }) => id === "file:src/user.ts").length, 1);
  assert.equal(graph.nodes.filter(({ id }) => id === "symbol:src/user.ts:class:User:1:1").length, 1);
  assert.equal(graph.edges.filter(({ kind }) => kind === "contains").length, 1);
  assert.equal(graph.edges.filter(({ kind }) => kind === "exports").length, 1);
  assert.equal(graph.edges.filter(({ kind }) => kind === "imports").length, 1);
});

test("continues graph construction when an analysis has an error", () => {
  const analyses = [
    analysis("src/broken.ts", [], [], [], "syntax error"),
    analysis("src/helpers.ts", [symbol("src/helpers.ts", "greet", "function", 1, 1, true)]),
  ];
  const graph = new CodeGraphBuilder().build(analyses);
  assert.ok(hasNode(graph, "file:src/broken.ts"));
  assert.ok(hasNode(graph, "symbol:src/helpers.ts:function:greet:1:1"));
  assert.ok(hasEdge(graph, "file:src/helpers.ts", "symbol:src/helpers.ts:function:greet:1:1", "contains"));
});

test("resolves common source extensions without inventing files", () => {
  const analyses = [
    analysis("src/a.ts", [], [{ source: "./b", importedNames: [] }]),
    analysis("src/b.jsx", []),
  ];
  const graph = new CodeGraphBuilder().build(analyses);
  assert.ok(hasEdge(graph, "file:src/a.ts", "file:src/b.jsx", "imports"));
  assert.equal(graph.nodes.filter(({ id }) => id.includes("b.")).length, 1);
});
