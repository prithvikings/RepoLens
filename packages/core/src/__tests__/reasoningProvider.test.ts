import assert from "node:assert/strict";
import test from "node:test";
import { CodeGraphBuilder } from "../graph/codeGraphBuilder.js";
import { ContextRetriever } from "../context/contextRetriever.js";
import { DeterministicReasoningProvider } from "../reasoning/deterministicReasoningProvider.js";
import type { ContextResult } from "../types/context.js";
import type { SourceFileAnalysis } from "../types/symbol.js";

function context(overrides: Partial<ContextResult> = {}): ContextResult {
  return {
    found: true,
    targetId: "file:src/a.ts",
    nodes: [
      {
        id: "file:src/a.ts",
        kind: "file",
        name: "a.ts",
        filePath: "src/a.ts",
      },
      {
        id: "file:src/b.ts",
        kind: "file",
        name: "b.ts",
        filePath: "src/b.ts",
      },
      {
        id: "symbol:src/a.ts:function:A:1:1",
        kind: "symbol",
        name: "A",
        filePath: "src/a.ts",
        symbolKind: "function",
      },
    ],
    edges: [
      {
        id: "edge:contains:file:src/a.ts->symbol:src/a.ts:function:A:1:1",
        source: "file:src/a.ts",
        target: "symbol:src/a.ts:function:A:1:1",
        kind: "contains",
      },
      {
        id: "edge:imports:file:src/a.ts->file:src/b.ts",
        source: "file:src/a.ts",
        target: "file:src/b.ts",
        kind: "imports",
      },
    ],
    analyses: [] as SourceFileAnalysis[],
    ...overrides,
  };
}

test("returns a reasoning result for a valid request", async () => {
  const result = await new DeterministicReasoningProvider().reason({
    question: "How does a.ts depend on b.ts?",
    context: context(),
  });

  assert.equal(typeof result.answer, "string");
  assert.ok(result.answer.length > 0);
});

test("produces deterministic output", async () => {
  const provider = new DeterministicReasoningProvider();
  const request = {
    question: "How does this file relate to b.ts?",
    context: context(),
  };

  const first = await provider.reason(request);
  const second = await provider.reason(request);

  assert.deepEqual(second, first);
});

test("consumes the question and structured context", async () => {
  const result = await new DeterministicReasoningProvider().reason({
    question: "What imports b.ts?",
    context: context(),
  });

  assert.match(result.answer, /What imports b\.ts\?/);
  assert.match(result.answer, /src\/a\.ts/);
  assert.match(result.answer, /src\/b\.ts/);
  assert.match(result.answer, /imports/);
});

test("handles empty context safely", async () => {
  const result = await new DeterministicReasoningProvider().reason({
    question: "What is in this context?",
    context: context({
      found: false,
      nodes: [],
      edges: [],
      analyses: [],
    }),
  });

  assert.match(result.answer, /Files: none/);
  assert.match(result.answer, /Symbols: none/);
  assert.match(result.answer, /Relationships: none/);
});

test("handles incomplete context collections safely", async () => {
  const result = await new DeterministicReasoningProvider().reason({
    question: "What can be determined?",
    context: context({
      nodes: [],
      edges: [],
      analyses: [],
    }),
  });

  assert.ok(result.answer.includes("Context found: true"));
  assert.ok(result.answer.includes("Files: none"));
});

test("consumes ContextRetriever output without graph coupling", async () => {
  const analyses: SourceFileAnalysis[] = [
    {
      filePath: "src/a.ts",
      language: "typescript",
      symbols: [
        {
          name: "A",
          kind: "function",
          filePath: "src/a.ts",
          line: 1,
          column: 1,
          exported: true,
        },
      ],
      imports: [{ source: "./b", importedNames: [{ importedName: "B" }] }],
      exports: [{ name: "A" }],
    },
    {
      filePath: "src/b.ts",
      language: "typescript",
      symbols: [],
      imports: [],
      exports: [],
    },
  ];
  const graph = new CodeGraphBuilder().build(analyses);
  const retrieved = new ContextRetriever(graph, analyses).retrieve({
    targetId: "file:src/a.ts",
    mode: "file",
  });

  const result = await new DeterministicReasoningProvider().reason({
    question: "How does a.ts relate to b.ts?",
    context: retrieved,
  });

  assert.equal(retrieved.found, true);
  assert.match(result.answer, /src\/a\.ts/);
  assert.match(result.answer, /src\/b\.ts/);
  assert.match(result.answer, /imports/);
});
