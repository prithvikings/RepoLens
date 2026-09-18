import * as vscode from "vscode";
import { DeterministicReasoningProvider, type ReasoningProvider } from "@repolens/core";
import { registerAskAboutCodeCommand } from "./commands/askAboutCodeCommand.js";
import { registerOpenCommand } from "./commands/openCommand.js";
import { OverviewProvider } from "./providers/overviewProvider.js";
import { CodeQuestionService } from "./services/codeQuestionService.js";
import { RepositoryScanService } from "./services/repositoryScanService.js";
import { SourceAnalysisService } from "./services/sourceAnalysisService.js";
import { getWorkspaceInfo } from "./services/workspaceService.js";

export function activate(context: vscode.ExtensionContext): void {
  const overviewProvider = new OverviewProvider();
  const openCommand = registerOpenCommand(context, overviewProvider);
  const overviewView = vscode.window.registerTreeDataProvider("repolens.overview", overviewProvider);

  const reasoningProvider: ReasoningProvider = new DeterministicReasoningProvider();
  const questionService = new CodeQuestionService(
    new RepositoryScanService(),
    new SourceAnalysisService(),
    reasoningProvider,
  );
  const askAboutCodeCommand = registerAskAboutCodeCommand(
    context,
    vscode,
    getWorkspaceInfo,
    questionService,
  );

  context.subscriptions.push(openCommand, askAboutCodeCommand, overviewView, overviewProvider);
}

export function deactivate(): void {
  // Reserved for future cleanup when RepoLens gains long-lived services.
}
