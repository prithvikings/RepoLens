import type { SymbolKind } from "./symbol.js";

export type GraphNodeKind = "file" | "symbol";

export type GraphEdgeKind = "imports" | "exports" | "contains";

export interface CodeGraphNode {
  id: string;
  kind: GraphNodeKind;
  name: string;
  filePath: string;
  symbolKind?: SymbolKind;
}

export interface CodeGraphEdge {
  id: string;
  source: string;
  target: string;
  kind: GraphEdgeKind;
}

export interface CodeGraph {
  nodes: CodeGraphNode[];
  edges: CodeGraphEdge[];
}
