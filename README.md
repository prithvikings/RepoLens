# RepoLens

RepoLens is a VS Code extension for understanding unfamiliar codebases.

## Current Status

**Phase 1 — Repository Scanner**

RepoLens can now scan an open workspace and report structural repository metadata including files, directories, language statistics, project ecosystems, package managers, frameworks, and important configuration files.

## Vision

```text
Repository
    → structural analysis
    → code graph
    → architecture visualization
    → dependency exploration
    → AI-powered codebase understanding
```

The architecture keeps repository/domain logic independent from VS Code:

```text
VS Code Workspace
    ↓
WorkspaceService
    ↓
RepositoryScanner
    ├── file discovery
    ├── language detection
    ├── project/framework detection
    └── configuration detection
    ↓
RepositoryMetadata
    ↓
RepoLens Overview
```

## Project Structure

```text
packages/
├── core/       # Framework-independent scanner and domain models
├── extension/  # VS Code API integration and UI providers
└── webview/    # React/TypeScript webview foundation
```

## Development

Requirements:

- Node.js 20+
- npm
- VS Code

Install dependencies:

```bash
npm install
```

Build all workspace packages:

```bash
npm run build
```

Type-check all workspace packages:

```bash
npm run type-check
```

Run scanner tests:

```bash
npm test
```

Open the repository in VS Code and start **Run RepoLens Extension** from the Run and Debug view. The standard VS Code Extension Development Host will launch the extension.

Open a workspace and run **RepoLens: Open** from the Command Palette. The RepoLens Activity Bar overview scans the workspace and displays the repository name, file and directory counts, detected languages, projects, package managers, and scan status.

If no workspace is open, RepoLens reports that state without attempting a filesystem scan.

## Detection Support

### Languages

TypeScript, JavaScript, Python, Java, Go, Rust, C++, C, C#, PHP, Ruby, Swift, Kotlin, Dart, HTML, CSS, SCSS, JSON, YAML, Markdown, and Shell.

`.tsx` and `.jsx` are grouped under TypeScript and JavaScript respectively for consistent language statistics.

### Project Types

Node.js, Python, Rust, Go, Java, PHP, and Ruby. Multiple ecosystems can be reported for the same repository.

### Package Managers

npm, Yarn, pnpm, Bun, Cargo, Go modules, Composer, and Bundler when reliable repository markers are present.

### Frameworks

React, Next.js, Vue, Angular, Svelte, Express, NestJS, Django, Flask, and FastAPI using dependency/project metadata rather than source parsing.

### Configuration

Common package/build/runtime configuration files are recognized, including package manifests and lockfiles, TypeScript/build configs, Docker files, Python/Rust/Go/Java/PHP/Ruby manifests, `.env.example`, and individual files under `.github/`.

Secret-bearing `.env`, `.env.local`, `.env.production`, and `.env.development` files are excluded from repository metadata.

## Phase 1 Scope

Implemented:

- recursive repository file and directory discovery
- conservative symlink handling
- generated/dependency directory exclusions
- extension-based language detection and file-count percentages
- multi-ecosystem project detection
- package manager detection from lockfiles
- lightweight framework detection from dependency/configuration metadata
- important configuration file discovery
- scanner error handling that skips unreadable items and continues where practical
- VS Code Overview integration
- automated scanner tests using temporary fixture repositories

Intentionally not implemented:

- AST parsing or symbol extraction
- Tree-sitter or TypeScript Compiler API analysis
- import, call, dependency, or architecture graphs
- graph visualization
- repository indexing or file watchers
- semantic search, embeddings, RAG, or vector storage
- LLM/AI integrations or chat
- code explanations or impact analysis
