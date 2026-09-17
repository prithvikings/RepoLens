import * as vscode from "vscode";
import { registerOpenCommand } from "./commands/openCommand.js";
import { OverviewProvider } from "./providers/overviewProvider.js";

export function activate(context: vscode.ExtensionContext): void {
  const overviewProvider = new OverviewProvider();
  const openCommand = registerOpenCommand(context, overviewProvider);
  const overviewView = vscode.window.registerTreeDataProvider("repolens.overview", overviewProvider);

  context.subscriptions.push(openCommand, overviewView, overviewProvider);
}

export function deactivate(): void {
  // Reserved for future cleanup when RepoLens gains long-lived services.
}
