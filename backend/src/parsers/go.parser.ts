import { DependencyParser, Ecosystem, NormalizedPackage, ParseResult } from './parser.interface.js';

export class GoDependencyParser implements DependencyParser {
  ecosystem: Ecosystem = 'golang';
  supportedFiles: string[] = ['go.mod'];

  canParse(filename: string): boolean {
    const base = filename.split('/').pop()?.split('\\').pop()?.toLowerCase() || '';
    return this.supportedFiles.includes(base);
  }

  parse(content: string, filename = 'go.mod'): ParseResult {
    const packages: NormalizedPackage[] = [];
    const projectName = content.match(/module\s+([^\s]+)/)?.[1] || 'go-project';
    const relationships: Array<{ source: string; target: string }> = [];

    // Parse single require lines: require github.com/foo/bar v1.2.3
    const singleRequireRegex = /require\s+([^\s]+)\s+([^\s]+)/g;
    let match: RegExpExecArray | null;
    while ((match = singleRequireRegex.exec(content)) !== null) {
      const name = match[1];
      const version = match[2].replace(/^v/, '');
      packages.push({
        name,
        version,
        ecosystem: 'golang',
        direct_dependency: true,
        depth: 1
      });
      relationships.push({ source: projectName, target: name });
    }

    // Parse block require: require ( ... )
    const blockMatch = content.match(/require\s*\(([\s\S]*?)\)/);
    if (blockMatch && blockMatch[1]) {
      const lines = blockMatch[1].split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//')) continue;
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          const name = parts[0];
          const version = parts[1].replace(/^v/, '');
          const isIndirect = trimmed.includes('// indirect');
          packages.push({
            name,
            version,
            ecosystem: 'golang',
            direct_dependency: !isIndirect,
            depth: isIndirect ? 2 : 1
          });
          relationships.push({ source: projectName, target: name });
        }
      }
    }

    return {
      projectName,
      ecosystem: 'golang',
      packages,
      rawRelationships: relationships
    };
  }
}
