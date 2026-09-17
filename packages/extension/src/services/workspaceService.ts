import * as vscode from "vscode";

export interface WorkspaceInfo {
  name: string;
  rootPath: vscode.Uri;
}

export function getWorkspaceInfo(): WorkspaceInfo | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return undefined;
  }

  return {
    name: folder.name,
    rootPath: folder.uri,
  };
}
