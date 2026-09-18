import assert from "node:assert/strict";
import test from "node:test";
import { CodeGraphBuilder } from "../graph/codeGraphBuilder.js";
import { ContextRetriever } from "../context/contextRetriever.js";
import type { CodeGraph, CodeGraphNode } from "../types/graph.js";
import type { SourceFileAnalysis } from "../types/symbol.js";

function analysis(
  filePath: string,
  symbols: SourceFileAnalysis["symbols"] = [],
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

function buildFixture(): { graph: CodeGraph; analyses: SourceFileAnalysis[] } {
  const analyses = [
    analysis(
      "src/a.ts",
      [symbol("src/a.ts", "A", "function", 1, 1, true)],
      [{ source: "./b", importedNames: [{ importedName: "B" }] }],
      [{ name: "A" }],
    ),
    analysis(
      "src/b.ts",
      [symbol("src/b.ts", "B", "function", 1, 1, true)],
      [{ source: "./c", importedNames: [{ importedName: "C" }] }],
      [{ name: "B" }],
    ),
    analysis("src/c.ts", [symbol("src/c.ts", "C", "function", 1, 1, true)], [], [{ name: "C" }]),
  ];

  return {
    analyses,
    graph: new CodeGraphBuilder().build(analyses),
  };
}

function ids(nodes: CodeGraphNode[]): string[] {
  return nodes.map(({ id }) => id);
}

test("retrieves file context with associated symbols and relationships", () => {
  const { graph, analyses } = buildFixture();
  const result = new ContextRetriever(graph, analyses).retrieve({
    targetId: "file:src/a.ts",
    mode: "file",
  });

  assert.equal(result.found, true);
  assert.deepEqual(ids(result.nodes), [
    "file:src/a.ts",
    "file:src/b.ts",
    "symbol:src/a.ts:function:A:1:1",
  ]);
  assert.deepEqual(result.edges.map(({ kind }) => kind), ["contains", "imports"]);
  assert.deepEqual(result.analyses.map(({ filePath }) => filePath), ["src/a.ts", "src/b.ts"]);
});

test("retrieves symbol context through the containing file", () => {
  const { graph, analyses } = buildFixture();
  const result = new ContextRetriever(graph, analyses).retrieve({
    targetId: "symbol:src/a.ts:function:A:1:1",
    mode: "symbol",
  });

  assert.equal(result.found, true);
  assert.ok(result.nodes.some(({ id }) => id === "file:src/a.ts"));
  assert.ok(result.edges.some(({ kind }) => kind === "contains"));
  assert.deepEqual(result.analyses.map(({ filePath }) => filePath), ["src/a.ts"]);
});

test("retrieves related nodes without inventing relationships", () => {
  const { graph, analyses } = buildFixture();
  const result = new ContextRetriever(graph, analyses).retrieve({
    targetId: "file:src/b.ts",
    mode: "related",
  });

  assert.equal(result.found, true);
  assert.deepEqual(ids(result.nodes), [
    "file:src/a.ts",
    "file:src/b.ts",
    "file:src/c.ts",
    "symbol:src/b.ts:function:B:1:1",
  ]);
  assert.ok(result.edges.some(({ source, target, kind }) =>
    source === "file:src/a.ts" && target === "file:src/b.ts" && kind === "imports",
  ));
  assert.ok(result.edges.some(({ source, target, kind }) =>
    source === "file:src/b.ts" && target === "file:src/c.ts" && kind === "imports",
  ));
});

test("retrieves a bounded graph neighborhood", () => {
  const { graph, analyses } = buildFixture();
  const result = new ContextRetriever(graph, analyses).retrieve({
    targetId: "file:src/a.ts",
    mode: "neighborhood",
    maxDepth: 2,
  });

  assert.equal(result.found, true);
  assert.deepEqual(ids(result.nodes), [
    "file:src/a.ts",
    "file:src/b.ts",
    "file:src/c.ts",
    "symbol:src/a.ts:function:A:1:1",
    "symbol:src/b.ts:function:B:1:1",
  ]);
});

test("honors depth and result limits", () => {
  const { graph, analyses } = buildFixture();
  const retriever = new ContextRetriever(graph, analyses);

  const depthZero = retriever.retrieve({
    targetId: "file:src/a.ts",
    mode: "neighborhood",
    maxDepth: 0,
  });
  assert.deepEqual(ids(depthZero.nodes), ["file:src/a.ts"]);

  const limited = retriever.retrieve({
    targetId: "file:src/a.ts",
    mode: "neighborhood",
    maxDepth: 10,
    maxResults: 2,
  });
  assert.equal(limited.nodes.length, 2);
  assert.ok(limited.nodes.some(({ id }) => id === "file:src/a.ts"));
});

test("returns deterministic results for repeated retrieval", () => {
  const { graph, analyses } = buildFixture();
  const retriever = new ContextRetriever(graph, [...analyses].reverse());

  const first = retriever.retrieve({
    targetId: "file:src/a.ts",
    mode: "neighborhood",
    maxDepth: 3,
    maxResults: 10,
  });
  const second = retriever.retrieve({
    targetId: "file:src/a.ts",
    mode: "neighborhood",
    maxDepth: 3,
    maxResults: 10,
  });

  assert.deepEqual(second, first);
});

test("handles missing nodes safely", () => {
  const { graph, analyses } = buildFixture();
  const result = new ContextRetriever(graph, analyses).retrieve({
    targetId: "file:src/missing.ts",
    mode: "file",
  });

  assert.equal(result.found, false);
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
  assert.deepEqual(result.analyses, []);
});

test("preserves malformed analysis resilience", () => {
  const analyses = [
    analysis("src/broken.ts", [], [], [], "syntax error"),
    analysis("src/helper.ts", [symbol("src/helper.ts", "helper", "function", 1)]),
  ];
  const graph = new CodeGraphBuilder().build(analyses);
  const result = new ContextRetriever(graph, analyses).retrieve({
    targetId: "file:src/broken.ts",
    mode: "file",
  });

  assert.equal(result.found, true);
  assert.deepEqual(ids(result.nodes), ["file:src/broken.ts"]);
  assert.equal(result.analyses[0]?.error, "syntax error");
});

test("handles an empty graph", () => {
  const result = new ContextRetriever({ nodes: [], edges: [] }, []).retrieve({
    targetId: "file:src/empty.ts",
    mode: "neighborhood",
  });

  assert.equal(result.found, false);
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.edges, []);
});

test("rejects invalid retrieval bounds", () => {
  const { graph, analyses } = buildFixture();
  const retriever = new ContextRetriever(graph, analyses);

  assert.throws(
    () => retriever.retrieve({ targetId: "file:src/a.ts", mode: "file", maxResults: 0 }),
    /maxResults must be a positive integer/,
  );
  assert.throws(
    () => retriever.retrieve({ targetId: "file:src/a.ts", mode: "neighborhood", maxDepth: -1 }),
    /maxDepth must be a non-negative integer/,
  );
});
