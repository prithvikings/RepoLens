import * as vscode from "vscode";
import { getWorkspaceInfo } from "../services/workspaceService.js";
import type { OverviewProvider } from "../providers/overviewProvider.js";

export function registerOpenCommand(
  context: vscode.ExtensionContext,
  overviewProvider: OverviewProvider,
): vscode.Disposable {
  return vscode.commands.registerCommand("repolens.open", async () => {
    const workspace = getWorkspaceInfo();

    if (!workspace) {
      void vscode.window.showInformationMessage(
        "RepoLens is ready. Open a workspace to inspect a repository.",
      );
      return;
    }

    await overviewProvider.refresh();
    void vscode.window.showInformationMessage(`RepoLens scanned ${workspace.name}.`);
  });
}
