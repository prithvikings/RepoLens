import type { CodeGraphEdge, CodeGraphNode } from "./graph.js";

export type ContextRetrievalMode = "file" | "symbol" | "related" | "neighborhood";

export interface ContextRequest {
  targetId: string;
  mode: ContextRetrievalMode;
  maxDepth?: number;
  maxResults?: number;
}

export interface ContextResult {
  found: boolean;
  targetId: string;
  nodes: CodeGraphNode[];
  edges: CodeGraphEdge[];
}
