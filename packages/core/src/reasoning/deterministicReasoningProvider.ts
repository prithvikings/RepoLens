import type { ContextResult } from "../types/context.js";
import type { ReasoningProvider, ReasoningRequest, ReasoningResult } from "./reasoning.js";

export class DeterministicReasoningProvider implements ReasoningProvider {
  public async reason(request: ReasoningRequest): Promise<ReasoningResult> {
    const question = request.question.trim();
    if (!question) {
      throw new RangeError("question must not be empty");
    }

    const context = request.context;
    return {
      answer: formatAnswer(question, context),
    };
  }
}

function formatAnswer(question: string, context: ContextResult): string {
  const files = context.nodes
    .filter((node) => node.kind === "file")
    .map((node) => node.filePath)
    .sort((a, b) => a.localeCompare(b));
  const symbols = context.nodes
    .filter((node) => node.kind === "symbol")
    .map((node) => node.name)
    .sort((a, b) => a.localeCompare(b));
  const relationships = [...context.edges]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((edge) => `${edge.source} --${edge.kind}--> ${edge.target}`);

  const sections = [
    `Question: ${question}`,
    `Context found: ${context.found}`,
    `Files: ${files.length > 0 ? files.join(", ") : "none"}`,
    `Symbols: ${symbols.length > 0 ? symbols.join(", ") : "none"}`,
    `Relationships: ${relationships.length > 0 ? relationships.join("; ") : "none"}`,
  ];

  return sections.join("\n");
}
