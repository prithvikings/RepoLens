import { CodeGraphBuilder, TypeScriptSourceAnalyzer, type CodeGraph, type SourceFileAnalysis } from "@repolens/core";
import type { RepositoryFile } from "@repolens/core";

export class SourceAnalysisService {
  private readonly analyzer = new TypeScriptSourceAnalyzer();
  private readonly graphBuilder = new CodeGraphBuilder();

  public analyze(files: RepositoryFile[]): Promise<SourceFileAnalysis[]> {
    return this.analyzer.analyze(files);
  }

  public buildGraph(analyses: SourceFileAnalysis[]): CodeGraph {
    return this.graphBuilder.build(analyses);
  }
}
