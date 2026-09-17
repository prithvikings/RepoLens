export interface RepositoryFile {
  path: string;
  relativePath: string;
  name: string;
  extension: string | null;
  size?: number;
}

export interface RepositoryDirectory {
  path: string;
  relativePath: string;
  name: string;
}

export interface LanguageInfo {
  language: string;
  fileCount: number;
  percentage: number;
}

export interface ProjectInfo {
  type: string;
  framework?: string;
  packageManager?: string;
}

export interface RepositoryMetadata {
  name: string;
  rootPath: string;
  files: RepositoryFile[];
  directories: RepositoryDirectory[];
  languages: LanguageInfo[];
  projects: ProjectInfo[];
  configFiles: string[];
  scannedAt: string;
}
