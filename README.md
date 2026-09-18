# Code Graph

Phase 3 adds a small framework-independent in-memory code graph to RepoLens.

## Model

The graph contains two node kinds:

- file — a repository-relative source file discovered and analyzed by Phase 2.
- symbol — a symbol extracted by the Phase 2 AST analyzer.

It contains three edge kinds:

- contains — a file contains one of its extracted symbols.
- imports — a file imports another repository-local source file.
- exports — a file exports one of its extracted symbols.

The graph builder consumes SourceFileAnalysis[] directly and does not depend on VS Code.

## IDs and determinism

File IDs are based on normalized repository-relative paths. Symbol IDs include the normalized path, symbol kind, name, and source location. Edge IDs are derived from the relationship kind and endpoint IDs.

The builder sorts its output and de-duplicates nodes and edges, so the same analyzed input produces the same graph regardless of input ordering.

## Local imports

Only relative imports are resolved. The builder checks the analyzed repository files using .ts, .tsx, .js, and .jsx candidates, plus matching index files. It never creates a file node for an unresolved path.

External imports such as react or express are ignored.

## Errors and limitations

A SourceFileAnalysis with an error does not stop graph construction; its file node is retained without symbol/relationship extraction. The graph does not perform TypeScript type resolution, call/reference analysis, package resolution, graph persistence, or visualization.
