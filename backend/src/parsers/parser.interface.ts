export type Ecosystem = 'npm' | 'pypi' | 'maven' | 'golang';

export interface NormalizedPackage {
  name: string;
  version: string;
  ecosystem: Ecosystem;
  direct_dependency: boolean;
  depth?: number;
  dependencies?: Record<string, string>; // package -> version spec
}

export interface ParseResult {
  projectName: string;
  ecosystem: Ecosystem;
  packages: NormalizedPackage[];
  rawRelationships?: Array<{ source: string; target: string }>;
}

export interface DependencyParser {
  ecosystem: Ecosystem;
  supportedFiles: string[];
  canParse(filename: string): boolean;
  parse(content: string, filename?: string): Promise<ParseResult> | ParseResult;
}
