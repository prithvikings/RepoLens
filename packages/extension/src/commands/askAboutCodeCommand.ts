import type * as vscode from "vscode";
import type { CodeQuestionService } from "../services/codeQuestionService.js";
import type { WorkspaceInfo } from "../services/workspaceService.js";

export interface AskAboutCodeVscodeApi {
  commands: Pick<typeof vscode.commands, "registerCommand">;
  window: Pick<typeof vscode.window, "showInformationMessage" | "showErrorMessage" | "showInputBox"> & {
    activeTextEditor?: vscode.TextEditor;
    createOutputChannel(name: string): vscode.OutputChannel;
  };
}

export function registerAskAboutCodeCommand(
  context: vscode.ExtensionContext,
  api: AskAboutCodeVscodeApi,
  getWorkspace: () => WorkspaceInfo | undefined,
  questionService: CodeQuestionService,
): vscode.Disposable {
  const disposable = api.commands.registerCommand("repolens.askAboutCode", async () => {
    const workspace = getWorkspace();
    if (!workspace) {
      void api.window.showInformationMessage("No workspace is open.");
      return;
    }

    const editor = api.window.activeTextEditor;
    if (!editor) {
      void api.window.showInformationMessage("Open a source file to ask RepoLens about it.");
      return;
    }

    const question = await api.window.showInputBox({
      prompt: "Ask RepoLens about the active source file",
      placeHolder: "How does this file relate to the codebase?",
    });
    if (!question?.trim()) return;

    try {
      const result = await questionService.ask(
        question,
        workspace.rootPath.fsPath,
        editor.document.uri.fsPath,
      );
      const output = api.window.createOutputChannel("RepoLens");
      output.clear();
      output.appendLine("RepoLens");
      output.appendLine("───────");
      output.appendLine("");
      output.appendLine(`Question: ${question.trim()}`);
      output.appendLine("");
      output.appendLine(result.answer);
      output.show(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void api.window.showErrorMessage(`RepoLens could not answer the question: ${message}`);
    }
  });
  return disposable;
}
