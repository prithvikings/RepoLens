import { promises as fs } from "node:fs";
import ts from "typescript";
import type { RepositoryFile } from "../types/repository.js";
import type {
  CodeSymbol,
  ExportReference,
  ImportBinding,
  ImportReference,
  SourceFileAnalysis,
  SourceLanguage,
  SymbolKind,
} from "../types/symbol.js";

export interface SourceAnalyzer {
  analyze(files: RepositoryFile[]): Promise<SourceFileAnalysis[]>;
}

export interface SourceAnalysisLogger {
  warn(message: string): void;
}

const DEFAULT_LOGGER: SourceAnalysisLogger = { warn: (message) => console.warn(message) };

const SUPPORTED_EXTENSIONS = new Map<string, SourceLanguage>([
  [".ts", "typescript"],
  [".tsx", "typescript"],
  [".js", "javascript"],
  [".jsx", "javascript"],
]);

export class TypeScriptSourceAnalyzer implements SourceAnalyzer {
  public constructor(private readonly logger: SourceAnalysisLogger = DEFAULT_LOGGER) {}

  public async analyze(files: RepositoryFile[]): Promise<SourceFileAnalysis[]> {
    const sourceFiles = files.filter((file) => SUPPORTED_EXTENSIONS.has(file.extension?.toLowerCase() ?? ""));
    return Promise.all(sourceFiles.map((file) => this.analyzeFile(file)));
  }

  private async analyzeFile(file: RepositoryFile): Promise<SourceFileAnalysis> {
    const language = SUPPORTED_EXTENSIONS.get(file.extension?.toLowerCase() ?? "");
    if (!language) {
      return {
        filePath: file.relativePath,
        language: "javascript",
        symbols: [],
        imports: [],
        exports: [],
        error: "unsupported",
      };
    }

    try {
      const content = await fs.readFile(file.path, "utf8");
      const sourceFile = ts.createSourceFile(
        file.path,
        content,
        ts.ScriptTarget.Latest,
        true,
        scriptKindFor(file.extension ?? ""),
      );
      const parseDiagnostics = sourceFile.parseDiagnostics;
      if (parseDiagnostics.length > 0) {
        const message = parseDiagnostics.map((diagnostic) => formatDiagnostic(diagnostic, sourceFile)).join("; ");
        this.logger.warn(`Unable to analyze ${file.relativePath}: ${message}`);
        return { filePath: file.relativePath, language, symbols: [], imports: [], exports: [], error: message };
      }

      return {
        filePath: file.relativePath,
        language,
        symbols: extractSymbols(sourceFile, file.relativePath),
        imports: extractImports(sourceFile),
        exports: extractExports(sourceFile),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Unable to analyze ${file.relativePath}: ${message}`);
      return { filePath: file.relativePath, language, symbols: [], imports: [], exports: [], error: message };
    }
  }
}

function extractSymbols(sourceFile: ts.SourceFile, filePath: string): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const visit = (node: ts.Node): void => {
    const symbol = symbolFromNode(node, sourceFile, filePath);
    if (symbol) symbols.push(symbol);
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return symbols;
}

function symbolFromNode(node: ts.Node, sourceFile: ts.SourceFile, filePath: string): CodeSymbol | undefined {
  let name: string | undefined;
  let kind: SymbolKind | undefined;

  if (ts.isFunctionDeclaration(node) && node.name) {
    name = node.name.text;
    kind = "function";
  } else if (ts.isClassDeclaration(node) && node.name) {
    name = node.name.text;
    kind = "class";
  } else if (ts.isMethodDeclaration(node) && node.name) {
    name = propertyNameText(node.name);
    kind = "method";
  } else if (ts.isInterfaceDeclaration(node)) {
    name = node.name.text;
    kind = "interface";
  } else if (ts.isTypeAliasDeclaration(node)) {
    name = node.name.text;
    kind = "type";
  } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
    name = node.name.text;
    kind = isFunctionInitializer(node.initializer) ? "function" : "variable";
  } else if (ts.isEnumDeclaration(node)) {
    name = node.name.text;
    kind = "enum";
  } else if (ts.isPropertyDeclaration(node) && node.name) {
    name = propertyNameText(node.name);
    kind = "property";
  } else if (ts.isConstructorDeclaration(node)) {
    name = "constructor";
    kind = "constructor";
  }

  if (!name || !kind) return undefined;

  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    name,
    kind,
    filePath,
    line: line + 1,
    column: character + 1,
    exported: hasExportModifier(node) || isExportedVariable(node),
  };
}

function extractImports(sourceFile: ts.SourceFile): ImportReference[] {
  const imports: ImportReference[] = [];

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      imports.push({ source: statement.moduleSpecifier.text, importedNames: importBindings(statement.importClause) });
    }
  }

  return imports;
}

function importBindings(importClause: ts.ImportClause | undefined): ImportBinding[] {
  if (!importClause) return [];

  const bindings: ImportBinding[] = [];
  if (importClause.name) bindings.push({ importedName: "default", localName: importClause.name.text });

  const namedBindings = importClause.namedBindings;
  if (!namedBindings) return bindings;

  if (ts.isNamespaceImport(namedBindings)) {
    bindings.push({ importedName: "*", localName: namedBindings.name.text });
    return bindings;
  }

  for (const element of namedBindings.elements) {
    bindings.push({
      importedName: element.propertyName?.text ?? element.name.text,
      ...(element.propertyName ? { localName: element.name.text } : {}),
    });
  }
  return bindings;
}

function extractExports(sourceFile: ts.SourceFile): ExportReference[] {
  const exports: ExportReference[] = [];

  for (const statement of sourceFile.statements) {
    if (hasExportModifier(statement)) {
      const declaration = declarationExportName(statement);
      if (declaration) exports.push({ name: declaration });
    }

    if (ts.isExportDeclaration(statement)) {
      const source = statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
        ? statement.moduleSpecifier.text
        : undefined;
      const clause = statement.exportClause;
      if (!clause) {
        exports.push({ name: "*", ...(source ? { source } : {}) });
      } else if (ts.isNamedExports(clause)) {
        for (const element of clause.elements) {
          exports.push({
            name: element.name.text,
            ...(source ? { source } : {}),
          });
        }
      }
    }
  }

  return exports;
}

function declarationExportName(statement: ts.Statement): string | undefined {
  if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isEnumDeclaration(statement)) {
    return statement.name?.text;
  }
  if (ts.isVariableStatement(statement)) {
    const names = statement.declarationList.declarations
      .filter((declaration) => ts.isIdentifier(declaration.name))
      .map((declaration) => (declaration.name as ts.Identifier).text);
    return names.join(", ") || undefined;
  }
  return undefined;
}

function hasExportModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true;
}

function isExportedVariable(node: ts.VariableDeclaration): boolean {
  return ts.isVariableStatement(node.parent.parent) && hasExportModifier(node.parent.parent);
}

function isFunctionInitializer(initializer: ts.Expression | undefined): boolean {
  return initializer !== undefined && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer));
}

function propertyNameText(name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return name.getText();
}

function scriptKindFor(extension: string): ts.ScriptKind {
  switch (extension.toLowerCase()) {
    case ".tsx": return ts.ScriptKind.TSX;
    case ".jsx": return ts.ScriptKind.JSX;
    case ".js": return ts.ScriptKind.JS;
    case ".ts": return ts.ScriptKind.TS;
    default: return ts.ScriptKind.Unknown;
  }
}

function formatDiagnostic(diagnostic: ts.Diagnostic, sourceFile: ts.SourceFile): string {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
  if (diagnostic.start === undefined) return message;
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
  return `${message} (line ${line + 1}, column ${character + 1})`;
}
