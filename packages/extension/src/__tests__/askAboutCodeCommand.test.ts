import assert from "node:assert/strict";
import test from "node:test";
import { registerAskAboutCodeCommand, type AskAboutCodeVscodeApi } from "../commands/askAboutCodeCommand.js";

function setup(input: string | undefined, workspace = true, editor = true) {
  let callback: (() => Promise<void>) | undefined;
  const messages: string[] = [];
  let askCalls = 0;
  let shouldFail = false;
  const outputLines: string[] = [];
  const api: AskAboutCodeVscodeApi = {
    commands: {
      registerCommand: (_id, command) => {
        callback = command as () => Promise<void>;
        return { dispose() {} };
      },
    },
    window: {
      showInputBox: async () => input,
      showInformationMessage: async (message) => { messages.push(message); return undefined; },
      showErrorMessage: async (message) => { messages.push(message); return undefined; },
      activeTextEditor: editor ? { document: { uri: { fsPath: "/workspace/src/a.ts" } } } as never : undefined,
      createOutputChannel: () => ({
        clear: () => {},
        appendLine: (line: string) => outputLines.push(line),
        show: () => {},
      }) as never,
    },
  };
  const service = {
    ask: async () => { askCalls += 1; if (shouldFail) throw new Error("question failed"); return { answer: "answer" }; },
  } as never;

  registerAskAboutCodeCommand(
    { subscriptions: [] } as never,
    api,
    () => workspace ? { name: "fixture", rootPath: { fsPath: "/workspace" } } as never : undefined,
    service,
  );
  return { callback: () => callback!(), messages, outputLines, setShouldFail: () => { shouldFail = true; }, getAskCalls: () => askCalls };
}

test("registers the Ask About Code command", () => {
  let commandId = "";
  const api: AskAboutCodeVscodeApi = {
    commands: {
      registerCommand: (id) => {
        commandId = id;
        return { dispose() {} };
      },
    },
    window: {
      showInputBox: async () => undefined,
      showInformationMessage: async () => undefined,
      showErrorMessage: async () => undefined,
      createOutputChannel: () => ({}) as never,
    },
  };
  registerAskAboutCodeCommand({ subscriptions: [] } as never, api, () => undefined, {} as never);
  assert.equal(commandId, "repolens.askAboutCode");
});

test("does not invoke reasoning for an empty question", async () => {
  const testCase = setup("   ");
  await testCase.callback();
  assert.equal(testCase.getAskCalls(), 0);
});

test("handles missing workspace and active editor", async () => {
  const noWorkspace = setup("question", false);
  await noWorkspace.callback();
  assert.deepEqual(noWorkspace.messages, ["No workspace is open."]);

  const noEditor = setup("question", true, false);
  await noEditor.callback();
  assert.deepEqual(noEditor.messages, ["Open a source file to ask RepoLens about it."]);
});

test("displays the reasoning answer through an output channel", async () => {
  const testCase = setup("How does this work?");
  await testCase.callback();
  assert.equal(testCase.askCalls, 1);
  assert.ok(testCase.outputLines.includes("answer"));
});

test("handles question service failures", async () => {
  const testCase = setup("How does this work?");
  testCase.setShouldFail();
  await testCase.callback();
  assert.equal(testCase.getAskCalls(), 1);
  assert.deepEqual(testCase.messages, ["RepoLens could not answer the question: question failed"]);
});
