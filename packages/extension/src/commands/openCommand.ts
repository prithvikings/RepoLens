import * as vscode from "vscode";
import { getWorkspaceInfo } from "../services/workspaceService";

export function registerOpenCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand("repolens.open", () => {
    const workspace = getWorkspaceInfo();

    if (!workspace) {
      void vscode.window.showInformationMessage(
        "RepoLens is ready. Open a workspace to inspect a repository.",
      );
      return;
    }

    void vscode.window.showInformationMessage(`RepoLens is ready for ${workspace.name}.`);
  });
}
