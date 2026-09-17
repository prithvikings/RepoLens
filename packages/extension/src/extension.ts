import * as vscode from "vscode";
import { registerOpenCommand } from "./commands/openCommand";
import { OverviewProvider } from "./providers/overviewProvider";

export function activate(context: vscode.ExtensionContext): void {
  const openCommand = registerOpenCommand(context);
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
