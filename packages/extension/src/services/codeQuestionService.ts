import { ContextRetriever, type ReasoningProvider, type ReasoningResult } from "@repolens/core";
import { RepositoryScanService } from "./repositoryScanService.js";
import { SourceAnalysisService } from "./sourceAnalysisService.js";

export class CodeQuestionService {
  public constructor(
    private readonly scanService: RepositoryScanService,
    private readonly sourceAnalysisService: SourceAnalysisService,
    private readonly reasoningProvider: ReasoningProvider,
  ) {}

  public async ask(question: string, workspaceRoot: string, targetFile: string): Promise<ReasoningResult> {
    if (!question.trim()) throw new RangeError("question must not be empty");

    const metadata = await this.scanService.scan(workspaceRoot);
    const relativeTarget = toRepositoryRelativePath(workspaceRoot, targetFile);
    const target = metadata.files.find((file) => file.relativePath === relativeTarget);
    if (!target) {
      throw new Error(`The active file is not part of the scanned workspace: ${relativeTarget}`);
    }

    const analyses = await this.sourceAnalysisService.analyze(metadata.files);
    const graph = this.sourceAnalysisService.buildGraph(analyses);
    const context = new ContextRetriever(graph, analyses).retrieve({
      targetId: `file:${relativeTarget}`,
      mode: "file",
    });

    return this.reasoningProvider.reason({ question, context });
  }
}

function toRepositoryRelativePath(workspaceRoot: string, targetFile: string): string {
  const root = workspaceRoot.replaceAll("\\", "/").replace(/\/$/, "");
  const file = targetFile.replaceAll("\\", "/");
  const prefix = root.endsWith("/") ? root : `${root}/`;
  return file.startsWith(prefix) ? file.slice(prefix.length) : file;
}
