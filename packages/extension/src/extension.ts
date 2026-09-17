import * as vscode from "vscode";
import { OverviewProvider } from "./providers/overviewProvider";
import { getWorkspaceInfo } from "./services/workspaceService";

export function activate(context: vscode.ExtensionContext): void {
  const openCommand = vscode.commands.registerCommand("repolens.open", () => {
    const workspace = getWorkspaceInfo();

    if (!workspace) {
      vscode.window.showInformationMessage("RepoLens is ready. Open a workspace to inspect a repository.");
      return;
    }

    vscode.window.showInformationMessage(`RepoLens is ready for ${workspace.name}.`);
  });

  const overviewProvider = new OverviewProvider();
  const overviewView = vscode.window.registerTreeDataProvider(
    "repolens.overview",
    overviewProvider,
  );

  context.subscriptions.push(openCommand, overviewView, overviewProvider);
}

export function deactivate(): void {
  // Reserved for future cleanup when RepoLens gains long-lived services.
}
