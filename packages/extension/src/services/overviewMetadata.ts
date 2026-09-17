import type { LanguageInfo, ProjectInfo } from "@repolens/core";

export function formatLanguageStatistics(languages: LanguageInfo[]): string {
  if (languages.length === 0) return "None detected";

  return languages
    .map(({ language, fileCount, percentage }) => `${language} ${fileCount} ${fileCount === 1 ? "file" : "files"} (${percentage.toFixed(1)}%)`)
    .join(" · ");
}

export function formatFrameworks(projects: ProjectInfo[]): string {
  const frameworks = [...new Set(
    projects
      .map(({ framework }) => framework?.trim())
      .filter((framework): framework is string => Boolean(framework)),
  )];

  return frameworks.length ? frameworks.join(" · ") : "None detected";
}

export function formatConfigurationFiles(configFiles: string[], maxItems = 8): string {
  if (configFiles.length === 0) return "None detected";
  if (configFiles.length <= maxItems) return configFiles.join(" · ");

  return `${configFiles.slice(0, maxItems).join(" · ")} · +${configFiles.length - maxItems} more`;
}
