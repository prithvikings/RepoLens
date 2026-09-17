import type { LanguageInfo, ProjectInfo, SourceFileAnalysis, SymbolKind } from "@repolens/core";

export function formatLanguageStatistics(languages: LanguageInfo[]): string {
  if (languages.length === 0) return "None detected";

  return languages
    .map(({ language, fileCount, percentage }) => `${language} ${fileCount} ${fileCount === 1 ? "file" : "files"} (${percentage.toFixed(1)}%)`)
    .join(" · ");
}

export function formatFrameworks(projects: ProjectInfo[]): string {
  const frameworks = new Set<string>();
  for (const project of projects) {
    for (const framework of project.framework?.split(",") ?? []) {
      const normalized = framework.trim();
      if (normalized) frameworks.add(normalized);
    }
  }

  return frameworks.size ? [...frameworks].join(" · ") : "None detected";
}

export function formatConfigurationFiles(configFiles: string[], maxItems = 8): string {
  if (configFiles.length === 0) return "None detected";
  if (configFiles.length <= maxItems) return configFiles.join(" · ");

  return `${configFiles.slice(0, maxItems).join(" · ")} · +${configFiles.length - maxItems} more`;
}

const SYMBOL_KINDS: SymbolKind[] = [
  "function",
  "class",
  "interface",
  "type",
  "variable",
  "enum",
  "method",
  "property",
  "constructor",
];

export function formatSymbolSummary(analyses: SourceFileAnalysis[]): string[] {
  const symbols = analyses.flatMap(({ symbols }) => symbols);
  const counts = new Map<SymbolKind, number>();
  for (const symbol of symbols) counts.set(symbol.kind, (counts.get(symbol.kind) ?? 0) + 1);

  return SYMBOL_KINDS
    .filter((kind) => (counts.get(kind) ?? 0) > 0)
    .map((kind) => `${capitalize(kind)} ${counts.get(kind) ?? 0}`);
}

export function formatAnalysisStatus(analyses: SourceFileAnalysis[]): string {
  const analyzedFiles = analyses.filter(({ error }) => !error).length;
  const errorFiles = analyses.filter(({ error }) => Boolean(error)).length;
  if (errorFiles === 0) return `Analyzed (${analyzedFiles} source files)`;
  return `Analyzed with ${errorFiles} error${errorFiles === 1 ? "" : "s"}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
