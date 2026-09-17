import { TypeScriptSourceAnalyzer, type SourceFileAnalysis } from "@repolens/core";
import type { RepositoryFile } from "@repolens/core";

export class SourceAnalysisService {
  private readonly analyzer = new TypeScriptSourceAnalyzer();

  public analyze(files: RepositoryFile[]): Promise<SourceFileAnalysis[]> {
    return this.analyzer.analyze(files);
  }
}
