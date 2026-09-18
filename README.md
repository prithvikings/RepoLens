# RepoLens

RepoLens is a VS Code extension for understanding unfamiliar codebases.

## Current Status

**Phase 6 — VS Code AI Interaction Layer**

RepoLens can scan a workspace, analyze TypeScript/JavaScript source structure, and build a deterministic in-memory code graph containing files, symbols, and repository-local import/export/containment relationships.

## Vision

Repository
    → structural analysis
    → code graph
    → architecture visualization
    → dependency exploration
    → AI-powered codebase understanding

The architecture keeps repository/domain logic independent from VS Code:

VS Code Workspace
    ↓
WorkspaceService
    ↓
RepositoryScanner
    ↓
RepositoryMetadata
    ↓
SourceFileAnalysis
    ↓
CodeGraphBuilder
    ↓
CodeGraph
    ↓
ContextRetriever
    ↓
ReasoningProvider
    ↓
ReasoningResult
    ↓
VS Code Interaction

## Project Structure

packages/
├── core/       # Framework-independent scanner, analysis, graph, and domain models
├── extension/  # VS Code API integration and UI providers
└── webview/    # React/TypeScript webview foundation

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

Run tests:

```bash
npm test
```

Open the repository in VS Code and start **Run RepoLens Extension** from the Run and Debug view. The standard VS Code Extension Development Host will launch the extension.

Open a workspace and run **RepoLens: Open** from the Command Palette. The RepoLens Activity Bar overview scans the workspace and displays repository metadata and Phase 2 analysis summaries.

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

Common package/build/runtime configuration files are recognized, including package manifests and lockfiles, TypeScript/build configs, Docker files, Python/Rust/Go/Java/PHP/Ruby manifests, .env.example, and individual files under .github/.

Secret-bearing .env, .env.local, .env.production, and .env.development files are excluded from repository metadata.

## Code Graph

Phase 3 adds a small framework-independent in-memory graph.

### Nodes

- file — a repository-relative source file participating in Phase 2 analysis.
- symbol — a symbol extracted by the Phase 2 AST analyzer.

### Edges

- contains — connects a file to its extracted symbols.
- imports — connects a file to a repository-local imported source file.
- exports — connects a file to an exported symbol.

### Determinism

File IDs use normalized repository-relative paths. Symbol IDs include the path, symbol kind, name, and source location. Edge IDs are derived from relationship kind and endpoint IDs. Graph output is sorted and de-duplicated.

### Local imports

Only relative imports are resolved. The builder checks actual analyzed repository files using .ts, .tsx, .js, and .jsx candidates, including index files. External imports are ignored and never become fake repository nodes.

### Limitations

The graph currently does not perform TypeScript type resolution, call/reference analysis, package dependency resolution, persistence, visualization, or AI/LLM processing.

## Phase 1 and Phase 2 Scope

Phase 1 implemented:

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

Phase 2 implemented:

- TypeScript Compiler API parsing
- TypeScript and JavaScript source support
- functions, arrow functions, classes, interfaces, type aliases, methods, properties, constructors, variables, and enums
- import and export extraction
- source locations and export status
- malformed-file isolation
- Phase 2 AST and scanner integration tests

Intentionally deferred:

- graph visualization
- repository indexing or file watchers
- semantic search, embeddings, RAG, or vector storage
- LLM/AI integrations or chat
- call graphs, semantic references, full type resolution, and cross-package semantic resolution

## Context Retrieval

Phase 4 adds a framework-independent deterministic context retrieval layer over the Phase 3 graph and Phase 2 source analyses.

### Retrieval

- file context — returns the target file plus directly related symbols/files and relationships.
- symbol context — returns a symbol with its directly related graph context, including its containing file.
- related context — returns one-hop related nodes using only existing graph edges.
- neighborhood context — performs bounded multi-hop traversal over existing relationships.

Results contain structured graph nodes/edges and the associated SourceFileAnalysis records for selected files. Retrieval supports caller-provided maxDepth and maxResults bounds, handles missing nodes without throwing, preserves malformed-source analysis errors, and sorts results deterministically.

Phase 4 does not perform semantic search, type resolution, call/reference analysis, embeddings, RAG, prompt generation, LLM calls, persistence, caching, or UI integration.

## AI Reasoning Boundary

Phase 5 adds a small framework-independent reasoning boundary that consumes the structured ContextResult produced by Phase 4.

The flow is:

ContextRetriever
    ↓
ReasoningProvider
    ↓
ReasoningResult

ReasoningRequest contains the user question and retrieved ContextResult. ReasoningProvider defines the reasoning abstraction, and ReasoningResult contains the resulting answer.

Phase 5 currently provides DeterministicReasoningProvider, an offline deterministic implementation used to validate the boundary. It does not represent an actual LLM and makes no network calls. The provider consumes the structured context directly; it does not perform graph traversal.

Real LLM integration, RAG, embeddings, semantic search, chat, streaming, persistence, and UI integration remain deferred.


## VS Code AI Interaction

Phase 6 adds the first user-facing interaction layer through the **RepoLens: Ask About Code** command.

The command:
1. accepts a user question through a VS Code input box;
2. uses the active source file as the context target;
3. runs the existing repository scanner, source analysis, and code graph pipeline;
4. retrieves deterministic file context through ContextRetriever;
5. passes the ContextResult to the ReasoningProvider;
6. displays the ReasoningResult answer in a RepoLens Output Channel.

The current reasoning implementation remains DeterministicReasoningProvider, so this flow is fully offline and makes no network or LLM calls.

Real LLM providers, semantic retrieval, chat UI, streaming, persistence, agents, and related AI infrastructure remain intentionally deferred.
