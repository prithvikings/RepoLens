export type SymbolKind =
  | "function"
  | "class"
  | "method"
  | "interface"
  | "type"
  | "variable"
  | "enum"
  | "property"
  | "constructor";

export interface SourceLocation {
  filePath: string;
  line: number;
  column: number;
}

export interface CodeSymbol {
  name: string;
  kind: SymbolKind;
  filePath: string;
  line: number;
  column: number;
  exported: boolean;
}

export interface ImportBinding {
  importedName: string;
  localName?: string;
}

export interface ImportReference {
  source: string;
  importedNames: ImportBinding[];
}

export interface ExportReference {
  name: string;
  source?: string;
}

export type SourceLanguage = "typescript" | "javascript";

export interface SourceFileAnalysis {
  filePath: string;
  language: SourceLanguage;
  symbols: CodeSymbol[];
  imports: ImportReference[];
  exports: ExportReference[];
  error?: string;
}
