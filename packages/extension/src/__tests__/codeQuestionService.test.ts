import assert from "node:assert/strict";
import test from "node:test";
import { CodeGraphBuilder, type RepositoryMetadata, type ReasoningProvider, type ReasoningRequest } from "@repolens/core";
import { CodeQuestionService } from "../services/codeQuestionService.js";

const metadata: RepositoryMetadata = {
  name: "fixture",
  rootPath: "/workspace",
  files: [
    { path: "/workspace/src/a.ts", relativePath: "src/a.ts", name: "a.ts", extension: ".ts" },
    { path: "/workspace/src/b.ts", relativePath: "src/b.ts", name: "b.ts", extension: ".ts" },
  ],
  directories: [],
  languages: [],
  projects: [],
  configFiles: [],
  scannedAt: "test",
};

const analyses = [
  { filePath: "src/a.ts", language: "typescript" as const, symbols: [], imports: [{ source: "./b", importedNames: [] }], exports: [] },
  { filePath: "src/b.ts", language: "typescript" as const, symbols: [], imports: [], exports: [] },
];

function createAnalysisService() {
  return {
    analyze: async () => analyses,
    buildGraph: (items: typeof analyses) => new CodeGraphBuilder().build(items),
  } as never;
}

test("uses the active file as context target and passes ContextResult to ReasoningProvider", async () => {
  let received: ReasoningRequest | undefined;
  const provider: ReasoningProvider = {
    reason: async (request) => {
      received = request;
      return { answer: "received" };
    },
  };
  const service = new CodeQuestionService({ scan: async () => metadata } as never, createAnalysisService(), provider);

  const result = await service.ask("How does this file relate to b?", "/workspace", "/workspace/src/a.ts");

  assert.equal(result.answer, "received");
  assert.equal(received?.question, "How does this file relate to b?");
  assert.equal(received?.context.targetId, "file:src/a.ts");
  assert.equal(received?.context.found, true);
});

test("does not invoke reasoning for an empty question", async () => {
  let called = false;
  const provider: ReasoningProvider = {
    reason: async () => { called = true; return { answer: "unexpected" }; },
  };
  const service = new CodeQuestionService({ scan: async () => metadata } as never, createAnalysisService(), provider);

  await assert.rejects(() => service.ask("   ", "/workspace", "/workspace/src/a.ts"), /question must not be empty/);
  assert.equal(called, false);
});

test("surfaces provider failures", async () => {
  const provider: ReasoningProvider = {
    reason: async () => { throw new Error("provider failed"); },
  };
  const service = new CodeQuestionService({ scan: async () => metadata } as never, createAnalysisService(), provider);

  await assert.rejects(() => service.ask("Explain this", "/workspace", "/workspace/src/a.ts"), /provider failed/);
});
