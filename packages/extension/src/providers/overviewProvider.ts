import * as vscode from "vscode";
import { getWorkspaceInfo } from "../services/workspaceService";

export class OverviewProvider implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<void>();

  readonly onDidChangeTreeData = this.emitter.event;

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.TreeItem[] {
    const workspace = getWorkspaceInfo();
    const repository = new vscode.TreeItem("Repository", vscode.TreeItemCollapsibleState.Expanded);
    repository.description = workspace?.name ?? "No workspace open";

    const status = new vscode.TreeItem("Status");
    status.description = workspace ? "Ready" : "No workspace";

    const availableSoon = new vscode.TreeItem("Available soon");
    availableSoon.description = "Architecture Map · Dependency Graph · Codebase Q&A";

    return [repository, status, availableSoon];
  }

  dispose(): void {
    this.emitter.dispose();
  }
}
