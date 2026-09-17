import * as vscode from "vscode";
import type { RepositoryMetadata } from "@repolens/core";
import { getWorkspaceInfo } from "../services/workspaceService.js";
import { RepositoryScanService } from "../services/repositoryScanService.js";
import {
  formatConfigurationFiles,
  formatFrameworks,
  formatLanguageStatistics,
} from "../services/overviewMetadata.js";

export class OverviewProvider implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<void>();
  private readonly scanService = new RepositoryScanService();
  private metadata: RepositoryMetadata | undefined;
  private error: string | undefined;

  public readonly onDidChangeTreeData = this.emitter.event;

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(): Promise<vscode.TreeItem[]> {
    const workspace = getWorkspaceInfo();
    if (!workspace) {
      return [this.item("Repository", "No workspace open"), this.item("Status", "Waiting for workspace")];
    }

    if (!this.metadata) await this.scan(workspace.rootPath.fsPath);

    if (this.error) {
      return [this.item("Repository", workspace.name), this.item("Status", "Scan failed"), this.item("Error", this.error)];
    }

    const metadata = this.metadata;
    if (!metadata) return [this.item("Status", "Scanning…")];

    const projects = metadata.projects.length
      ? [...new Set(metadata.projects.map(({ type }) => type))].join(" · ")
      : "None detected";
    const packageManagers = [...new Set(metadata.projects.map(({ packageManager }) => packageManager).filter(Boolean))].join(" · ") || "Not detected";

    return [
      this.item("Repository", metadata.name),
      this.item("Files", String(metadata.files.length)),
      this.item("Directories", String(metadata.directories.length)),
      this.item("Languages", formatLanguageStatistics(metadata.languages)),
      this.item("Projects", projects),
      this.item("Frameworks", formatFrameworks(metadata.projects)),
      this.item("Package Manager", packageManagers),
      this.item("Configuration", formatConfigurationFiles(metadata.configFiles)),
      this.item("Status", "Scanned"),
    ];
  }

  public async refresh(): Promise<void> {
    const workspace = getWorkspaceInfo();
    this.metadata = undefined;
    this.error = undefined;
    if (workspace) await this.scan(workspace.rootPath.fsPath);
    this.emitter.fire();
  }

  public dispose(): void {
    this.emitter.dispose();
  }

  private async scan(rootPath: string): Promise<void> {
    try {
      this.metadata = await this.scanService.scan(rootPath);
      this.error = undefined;
    } catch (error) {
      this.metadata = undefined;
      this.error = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(`RepoLens could not scan the workspace: ${this.error}`);
    }
  }

  private item(label: string, description?: string): vscode.TreeItem {
    const item = new vscode.TreeItem(label);
    item.description = description;
    item.tooltip = description;
    return item;
  }
}
