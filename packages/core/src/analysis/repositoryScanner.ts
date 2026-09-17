import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  LanguageInfo,
  ProjectInfo,
  RepositoryDirectory,
  RepositoryFile,
  RepositoryMetadata,
} from "../types/repository.js";

export interface RepositoryScanner {
  scan(rootPath: string): Promise<RepositoryMetadata>;
}

export interface ScanLogger {
  warn(message: string): void;
}

const DEFAULT_LOGGER: ScanLogger = { warn: (message) => console.warn(message) };

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  ".vscode",
]);

const SECRET_ENV_FILES = new Set([".env", ".env.local", ".env.production", ".env.development"]);

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".py": "Python",
  ".java": "Java",
  ".go": "Go",
  ".rs": "Rust",
  ".cpp": "C++",
  ".c": "C",
  ".cs": "C#",
  ".php": "PHP",
  ".rb": "Ruby",
  ".swift": "Swift",
  ".kt": "Kotlin",
  ".dart": "Dart",
  ".html": "HTML",
  ".css": "CSS",
  ".scss": "SCSS",
  ".json": "JSON",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".md": "Markdown",
  ".sh": "Shell",
};

const CONFIG_FILE_PATTERNS = [
  /^package\.json$/,
  /^package-lock\.json$/,
  /^pnpm-lock\.yaml$/,
  /^yarn\.lock$/,
  /^bun\.lockb$/,
  /^bun\.lock$/,
  /^tsconfig(?:\..+)?\.json$/,
  /^vite\.config\..+$/,
  /^next\.config\..+$/,
  /^webpack\.config\..+$/,
  /^docker-compose\.(?:yml|yaml)$/,
  /^Dockerfile(?:\..+)?$/,
  /^requirements\.txt$/,
  /^pyproject\.toml$/,
  /^Cargo\.toml$/,
  /^go\.mod$/,
  /^pom\.xml$/,
  /^build\.gradle(?:\.kts)?$/,
  /^composer\.json$/,
  /^Gemfile$/,
  /^\.env\.example$/,
];

const NODE_FRAMEWORKS: Array<[string, string]> = [
  ["next", "Next.js"],
  ["react", "React"],
  ["@angular/core", "Angular"],
  ["vue", "Vue"],
  ["svelte", "Svelte"],
  ["express", "Express"],
  ["@nestjs/core", "NestJS"],
];

const PYTHON_FRAMEWORKS: Array<[string, string]> = [
  ["django", "Django"],
  ["flask", "Flask"],
  ["fastapi", "FastAPI"],
];

interface DiscoveredFile extends RepositoryFile {
  absolutePath: string;
}

export class FileRepositoryScanner implements RepositoryScanner {
  public constructor(private readonly logger: ScanLogger = DEFAULT_LOGGER) {}

  public async scan(rootPath: string): Promise<RepositoryMetadata> {
    const absoluteRoot = path.resolve(rootPath);
    const rootStat = await fs.stat(absoluteRoot);
    if (!rootStat.isDirectory()) {
      throw new Error(`Repository root is not a directory: ${absoluteRoot}`);
    }

    const files: DiscoveredFile[] = [];
    const directories: RepositoryDirectory[] = [];
    await this.walkDirectory(absoluteRoot, absoluteRoot, files, directories, new Set());

    const publicFiles = files.map(({ absolutePath: _absolutePath, ...file }) => file);
    const languages = detectLanguageStatistics(publicFiles);
    const projects = await detectProjects(absoluteRoot, files, this.logger);
    const configFiles = detectConfigFiles(files);

    return {
      name: path.basename(absoluteRoot),
      rootPath: absoluteRoot,
      files: publicFiles,
      directories,
      languages,
      projects,
      configFiles,
      scannedAt: new Date().toISOString(),
    };
  }

  private async walkDirectory(
    rootPath: string,
    currentPath: string,
    files: DiscoveredFile[],
    directories: RepositoryDirectory[],
    visitedDirectories: Set<string>,
  ): Promise<void> {
    const realCurrentPath = await fs.realpath(currentPath);
    if (visitedDirectories.has(realCurrentPath)) return;
    visitedDirectories.add(realCurrentPath);

    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch (error) {
      this.logger.warn(`Unable to read directory ${currentPath}: ${formatError(error)}`);
      return;
    }

    for (const entry of entries) {
      if (entry.name === "." || entry.name === "..") continue;
      if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue;
      if (SECRET_ENV_FILES.has(entry.name)) continue;

      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = toRelativePath(rootPath, absolutePath);

      let stat;
      try {
        stat = await fs.lstat(absolutePath);
      } catch (error) {
        this.logger.warn(`Unable to inspect ${absolutePath}: ${formatError(error)}`);
        continue;
      }

      if (stat.isSymbolicLink()) continue;

      if (stat.isDirectory()) {
        directories.push({ path: absolutePath, relativePath, name: entry.name });
        await this.walkDirectory(rootPath, absolutePath, files, directories, visitedDirectories);
        continue;
      }

      if (!stat.isFile()) continue;

      files.push({
        path: absolutePath,
        absolutePath,
        relativePath,
        name: entry.name,
        extension: getExtension(entry.name),
        size: stat.size,
      });
    }
  }
}

function getExtension(fileName: string): string | null {
  const extension = path.extname(fileName).toLowerCase();
  return extension || null;
}

function toRelativePath(rootPath: string, targetPath: string): string {
  return path.relative(rootPath, targetPath).split(path.sep).join("/");
}

export function detectLanguageStatistics(files: RepositoryFile[]): LanguageInfo[] {
  const counts = new Map<string, number>();
  for (const file of files) {
    if (!file.extension) continue;
    const language = LANGUAGE_BY_EXTENSION[file.extension.toLowerCase()];
    if (!language) continue;
    counts.set(language, (counts.get(language) ?? 0) + 1);
  }

  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([language, fileCount]) => ({
      language,
      fileCount,
      percentage: total === 0 ? 0 : Number(((fileCount / total) * 100).toFixed(1)),
    }));
}

async function detectProjects(
  rootPath: string,
  files: DiscoveredFile[],
  logger: ScanLogger,
): Promise<ProjectInfo[]> {
  const names = new Set(files.map((file) => file.relativePath.split("/").pop()));
  const projects: ProjectInfo[] = [];
  const packageJsonFiles = files.filter((file) => file.name === "package.json");

  if (packageJsonFiles.length > 0) {
    const packageManagers = detectPackageManagers(names);
    const packageManager = packageManagers[0];
    const frameworkNames = new Set<string>();

    for (const file of packageJsonFiles) {
      const dependencies = await readNodeDependencies(file.absolutePath, logger);
      for (const [dependency, framework] of NODE_FRAMEWORKS) {
        if (dependencies.has(dependency)) frameworkNames.add(framework);
      }
    }

    projects.push({ type: "Node.js", ...(frameworkNames.size ? { framework: [...frameworkNames].join(", ") } : {}), ...(packageManager ? { packageManager } : {}) });
  }

  if (["requirements.txt", "pyproject.toml", "Pipfile", "setup.py"].some((name) => names.has(name))) {
    const frameworkNames = new Set<string>();
    for (const file of files.filter((candidate) => ["requirements.txt", "pyproject.toml"].includes(candidate.name))) {
      const content = await readText(file.absolutePath, logger);
      for (const [dependency, framework] of PYTHON_FRAMEWORKS) {
        if (containsDependency(content, dependency)) frameworkNames.add(framework);
      }
    }
    projects.push({ type: "Python", ...(frameworkNames.size ? { framework: [...frameworkNames].join(", ") } : {}) });
  }

  if (names.has("Cargo.toml")) projects.push({ type: "Rust", packageManager: "Cargo" });
  if (names.has("go.mod")) projects.push({ type: "Go", packageManager: "Go modules" });
  if (names.has("pom.xml") || names.has("build.gradle") || names.has("build.gradle.kts")) projects.push({ type: "Java" });
  if (names.has("composer.json")) projects.push({ type: "PHP", packageManager: "Composer" });
  if (names.has("Gemfile")) projects.push({ type: "Ruby", packageManager: "Bundler" });

  return projects;
}

function detectPackageManagers(names: Set<string>): string[] {
  if (names.has("package-lock.json")) return ["npm"];
  if (names.has("yarn.lock")) return ["Yarn"];
  if (names.has("pnpm-lock.yaml")) return ["pnpm"];
  if (names.has("bun.lockb") || names.has("bun.lock")) return ["Bun"];
  return [];
}

function detectConfigFiles(files: DiscoveredFile[]): string[] {
  return files
    .filter((file) => {
      const name = file.name;
      return CONFIG_FILE_PATTERNS.some((pattern) => pattern.test(name)) || file.relativePath.startsWith(".github/");
    })
    .map((file) => file.relativePath)
    .sort();
}

async function readNodeDependencies(filePath: string, logger: ScanLogger): Promise<Set<string>> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") return new Set();
    const record = parsed as Record<string, unknown>;
    const dependencies = new Set<string>();
    for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      const values = record[section];
      if (!values || typeof values !== "object") continue;
      for (const name of Object.keys(values as Record<string, unknown>)) dependencies.add(name);
    }
    return dependencies;
  } catch (error) {
    logger.warn(`Unable to parse ${filePath}: ${formatError(error)}`);
    return new Set();
  }
}

async function readText(filePath: string, logger: ScanLogger): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    logger.warn(`Unable to read ${filePath}: ${formatError(error)}`);
    return "";
  }
}

function containsDependency(content: string, dependency: string): boolean {
  const normalized = content.toLowerCase();
  return new RegExp(`(?:^|[\\s"'=:<>])${escapeRegExp(dependency)}(?:$|[\\s"'=:<>])`, "m").test(normalized);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
