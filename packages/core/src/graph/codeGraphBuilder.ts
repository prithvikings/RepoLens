import type {
  CodeGraph,
  CodeGraphEdge,
  CodeGraphNode,
} from "../types/graph.js";
import type { SourceFileAnalysis } from "../types/symbol.js";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"] as const;

export class CodeGraphBuilder {
  public build(analyses: SourceFileAnalysis[]): CodeGraph {
    const nodes = new Map<string, CodeGraphNode>();
    const edges = new Map<string, CodeGraphEdge>();
    const files = new Set(analyses.map(({ filePath }) => normalizePath(filePath)));

    for (const analysis of [...analyses].sort(byFilePath)) {
      const filePath = normalizePath(analysis.filePath);
      const fileId = fileNodeId(filePath);
      nodes.set(fileId, {
        id: fileId,
        kind: "file",
        name: basename(filePath),
        filePath,
      });

      if (analysis.error) continue;

      for (const symbol of [...analysis.symbols].sort(bySymbol)) {
        const symbolId = symbolNodeId(symbol.filePath, symbol.name, symbol.kind, symbol.line, symbol.column);
        nodes.set(symbolId, {
          id: symbolId,
          kind: "symbol",
          name: symbol.name,
          filePath,
          symbolKind: symbol.kind,
        });
        addEdge(edges, {
          id: edgeId("contains", fileId, symbolId),
          source: fileId,
          target: symbolId,
          kind: "contains",
        });
      }

      for (const exportReference of analysis.exports) {
        for (const exportName of splitExportNames(exportReference.name)) {
          const target = resolveExportTarget(analysis, exportName, exportReference.source, analyses, files);
          if (!target) continue;
          addEdge(edges, {
            id: edgeId("exports", fileId, target),
            source: fileId,
            target,
            kind: "exports",
          });
        }
      }

      for (const importReference of analysis.imports) {
        const targetPath = resolveLocalImport(filePath, importReference.source, files);
        if (!targetPath) continue;
        const target = fileNodeId(targetPath);
        addEdge(edges, {
          id: edgeId("imports", fileId, target),
          source: fileId,
          target,
          kind: "imports",
        });
      }
    }

    return {
      nodes: [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
      edges: [...edges.values()].sort((a, b) => a.id.localeCompare(b.id)),
    };
  }
}

function resolveExportTarget(
  analysis: SourceFileAnalysis,
  name: string,
  source: string | undefined,
  analyses: SourceFileAnalysis[],
  files: Set<string>,
): string | undefined {
  if (!source) return findSymbolId(analysis, name);

  const sourcePath = resolveLocalImport(normalizePath(analysis.filePath), source, files);
  if (!sourcePath) return undefined;

  const sourceAnalysis = analyses.find(({ filePath }) => normalizePath(filePath) === sourcePath);
  return sourceAnalysis ? findSymbolId(sourceAnalysis, name) : undefined;
}

function findSymbolId(analysis: SourceFileAnalysis, name: string): string | undefined {
  const symbol = analysis.symbols.find(({ name: symbolName }) => symbolName === name);
  return symbol ? symbolNodeId(symbol.filePath, symbol.name, symbol.kind, symbol.line, symbol.column) : undefined;
}

function resolveLocalImport(importingFile: string, source: string, files: Set<string>): string | undefined {
  if (!source.startsWith(".")) return undefined;

  const base = normalizePath(join(dirname(importingFile), source));
  const candidates = new Set<string>([base]);

  for (const extension of SOURCE_EXTENSIONS) {
    candidates.add(base.endsWith(extension) ? base : base + extension);
  }

  for (const extension of SOURCE_EXTENSIONS) {
    candidates.add(join(base, "index" + extension));
  }

  return [...candidates].find((candidate) => files.has(candidate));
}

function addEdge(edges: Map<string, CodeGraphEdge>, edge: CodeGraphEdge): void {
  edges.set(edge.id, edge);
}

function edgeId(kind: CodeGraphEdge["kind"], source: string, target: string): string {
  return "edge:" + kind + ":" + source + "->" + target;
}

function fileNodeId(filePath: string): string {
  return "file:" + normalizePath(filePath);
}

function symbolNodeId(
  filePath: string,
  name: string,
  kind: SourceFileAnalysis["symbols"][number]["kind"],
  line: number,
  column: number,
): string {
  return "symbol:" + normalizePath(filePath) + ":" + kind + ":" + encodeURIComponent(name) + ":" + line + ":" + column;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

function dirname(value: string): string {
  const index = value.lastIndexOf("/");
  return index === -1 ? "" : value.slice(0, index);
}

function join(left: string, right: string): string {
  return normalizePath(left ? left + "/" + right : right);
}

function basename(value: string): string {
  const index = value.lastIndexOf("/");
  return index === -1 ? value : value.slice(index + 1);
}

function splitExportNames(name: string): string[] {
  return name.split(",").map((value) => value.trim()).filter(Boolean);
}

function byFilePath(a: SourceFileAnalysis, b: SourceFileAnalysis): number {
  return normalizePath(a.filePath).localeCompare(normalizePath(b.filePath));
}

function bySymbol(
  a: SourceFileAnalysis["symbols"][number],
  b: SourceFileAnalysis["symbols"][number],
): number {
  return a.line - b.line || a.column - b.column || a.name.localeCompare(b.name) || a.kind.localeCompare(b.kind);
}
