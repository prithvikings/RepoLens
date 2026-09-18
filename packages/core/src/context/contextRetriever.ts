import type { CodeGraph, CodeGraphEdge, CodeGraphNode } from "../types/graph.js";
import type { SourceFileAnalysis } from "../types/symbol.js";
import type { ContextRequest, ContextResult } from "../types/context.js";

export class ContextRetriever {
  private readonly nodesById = new Map<string, CodeGraphNode>();
  private readonly adjacency = new Map<string, Array<{ nodeId: string; edge: CodeGraphEdge }>>();
  private readonly analysesByFile = new Map<string, SourceFileAnalysis>();

  public constructor(graph: CodeGraph, analyses: SourceFileAnalysis[]) {
    for (const node of graph.nodes) {
      this.nodesById.set(node.id, node);
    }

    for (const edge of graph.edges) {
      this.addAdjacency(edge.source, edge.target, edge);
      this.addAdjacency(edge.target, edge.source, edge);
    }

    for (const analysis of analyses) {
      this.analysesByFile.set(normalizePath(analysis.filePath), analysis);
    }

    for (const entries of this.adjacency.values()) {
      entries.sort((a, b) => a.nodeId.localeCompare(b.nodeId) || a.edge.id.localeCompare(b.edge.id));
    }
  }

  public retrieve(request: ContextRequest): ContextResult {
    const target = this.nodesById.get(request.targetId);
    if (!target) {
      return {
        found: false,
        targetId: request.targetId,
        nodes: [],
        edges: [],
        analyses: [],
      };
    }

    const maxResults = normalizeLimit(request.maxResults);
    const maxDepth = normalizeDepth(request.maxDepth);

    let nodeIds: string[];

    switch (request.mode) {
      case "file":
        nodeIds = this.directContext(target, "file", maxResults);
        break;
      case "symbol":
        nodeIds = this.directContext(target, "symbol", maxResults);
        break;
      case "related":
        nodeIds = this.relatedNodes(target.id, maxResults);
        break;
      case "neighborhood":
        nodeIds = this.neighborhood(target.id, maxDepth, maxResults);
        break;
    }

    const selected = new Set(nodeIds);
    const nodes = nodeIds
      .map((id) => this.nodesById.get(id))
      .filter((node): node is CodeGraphNode => node !== undefined)
      .sort((a, b) => a.id.localeCompare(b.id));

    const edges = this.edgesBetween(selected).sort((a, b) => a.id.localeCompare(b.id));
    const analyses = nodes
      .filter((node) => node.kind === "file")
      .map((node) => this.analysesByFile.get(normalizePath(node.filePath)))
      .filter((analysis): analysis is SourceFileAnalysis => analysis !== undefined)
      .sort((a, b) => normalizePath(a.filePath).localeCompare(normalizePath(b.filePath)));

    return {
      found: true,
      targetId: target.id,
      nodes,
      edges,
      analyses,
    };
  }

  private directContext(target: CodeGraphNode, expectedKind: "file" | "symbol", maxResults: number): string[] {
    if (target.kind !== expectedKind) return [];
    return this.limitWithTarget(target.id, this.relatedNodes(target.id, Number.MAX_SAFE_INTEGER), maxResults);
  }

  private relatedNodes(targetId: string, maxResults: number): string[] {
    const entries = this.adjacency.get(targetId) ?? [];
    const ids = [...new Set(entries.map(({ nodeId }) => nodeId))].sort((a, b) => a.localeCompare(b));
    return ids.slice(0, maxResults);
  }

  private neighborhood(targetId: string, maxDepth: number, maxResults: number): string[] {
    const visited = new Set<string>([targetId]);
    let frontier = [targetId];

    for (let depth = 0; depth < maxDepth && visited.size < maxResults; depth += 1) {
      const next: string[] = [];

      for (const nodeId of [...frontier].sort((a, b) => a.localeCompare(b))) {
        for (const { nodeId: neighborId } of this.adjacency.get(nodeId) ?? []) {
          if (visited.has(neighborId)) continue;
          visited.add(neighborId);
          next.push(neighborId);
          if (visited.size >= maxResults) break;
        }
        if (visited.size >= maxResults) break;
      }

      frontier = [...new Set(next)].sort((a, b) => a.localeCompare(b));
      if (frontier.length === 0) break;
    }

    return [...visited].sort((a, b) => a.localeCompare(b));
  }

  private limitWithTarget(targetId: string, related: string[], maxResults: number): string[] {
    if (maxResults <= 1) return [targetId];
    return [targetId, ...related.filter((id) => id !== targetId).slice(0, maxResults - 1)]
      .sort((a, b) => a.localeCompare(b));
  }

  private edgesBetween(nodeIds: Set<string>): CodeGraphEdge[] {
    const edges = new Map<string, CodeGraphEdge>();
    for (const nodeId of nodeIds) {
      for (const { edge } of this.adjacency.get(nodeId) ?? []) {
        if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
          edges.set(edge.id, edge);
        }
      }
    }
    return [...edges.values()];
  }
}

function normalizeLimit(value: number | undefined): number {
  if (value === undefined) return Number.MAX_SAFE_INTEGER;
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError("maxResults must be a positive integer");
  }
  return value;
}

function normalizeDepth(value: number | undefined): number {
  if (value === undefined) return 1;
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError("maxDepth must be a non-negative integer");
  }
  return value;
}

function normalizePath(value: string): string {
  const segments: string[] = [];
  for (const segment of value.replace(/\\/g, "/").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (segments.length > 0) segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join("/");
}
