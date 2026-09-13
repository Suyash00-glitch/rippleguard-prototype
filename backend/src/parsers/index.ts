import { DependencyParser, Ecosystem, ParseResult } from './parser.interface.js';
import { NpmDependencyParser } from './npm.parser.js';
import { PythonDependencyParser } from './python.parser.js';
import { MavenDependencyParser } from './maven.parser.js';
import { GoDependencyParser } from './go.parser.js';

export * from './parser.interface.js';
export * from './npm.parser.js';
export * from './python.parser.js';
export * from './maven.parser.js';
export * from './go.parser.js';

export class ParserFactory {
  private static parsers: DependencyParser[] = [
    new NpmDependencyParser(),
    new PythonDependencyParser(),
    new MavenDependencyParser(),
    new GoDependencyParser(),
  ];

  static getParserForFile(filename: string): DependencyParser | null {
    for (const parser of this.parsers) {
      if (parser.canParse(filename)) {
        return parser;
      }
    }
    return null;
  }

  static getParserForEcosystem(ecosystem: Ecosystem): DependencyParser | null {
    return this.parsers.find(p => p.ecosystem === ecosystem) || null;
  }

  static parse(filename: string, content: string): ParseResult {
    const parser = this.getParserForFile(filename);
    if (!parser) {
      throw new Error(`Unsupported dependency file: ${filename}`);
    }
    return parser.parse(content, filename) as ParseResult;
  }
}
