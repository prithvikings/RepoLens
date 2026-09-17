export type NodeType =
  | "file"
  | "directory"
  | "module"
  | "class"
  | "function"
  | "variable"
  | "interface"
  | "route";

export type EdgeType =
  | "imports"
  | "exports"
  | "calls"
  | "extends"
  | "implements"
  | "references"
  | "contains";

export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  path?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
}
