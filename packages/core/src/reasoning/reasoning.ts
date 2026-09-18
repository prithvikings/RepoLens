import type { ContextResult } from "../types/context.js";

export interface ReasoningRequest {
  question: string;
  context: ContextResult;
}

export interface ReasoningResult {
  answer: string;
}

export interface ReasoningProvider {
  reason(request: ReasoningRequest): Promise<ReasoningResult>;
}
