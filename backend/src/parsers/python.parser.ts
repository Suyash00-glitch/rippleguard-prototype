import { DependencyParser, Ecosystem, NormalizedPackage, ParseResult } from './parser.interface.js';

export class PythonDependencyParser implements DependencyParser {
  ecosystem: Ecosystem = 'pypi';
  supportedFiles: string[] = ['requirements.txt', 'pyproject.toml', 'Pipfile'];

  canParse(filename: string): boolean {
    const base = filename.split('/').pop()?.split('\\').pop()?.toLowerCase() || '';
    return this.supportedFiles.some(f => base.endsWith(f.toLowerCase()));
  }

  parse(content: string, filename = 'requirements.txt'): ParseResult {
    const base = filename.toLowerCase();
    if (base.includes('pyproject.toml')) {
      return this.parsePyprojectToml(content);
    }
    return this.parseRequirementsTxt(content);
  }

  private parseRequirementsTxt(content: string): ParseResult {
    const lines = content.split('\n');
    const packages: NormalizedPackage[] = [];
    const projectName = 'python-project';
    const relationships: Array<{ source: string; target: string }> = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('-r') || line.startsWith('-e')) {
        continue;
      }

      // Regex matching package specifications: e.g. requests==2.25.1, flask>=1.1.2, urllib3~=1.26.4
      const match = line.match(/^([a-zA-Z0-9_\-\.]+)(?:([=><~^!]+)(.*))?$/);
      if (match) {
        const name = match[1].toLowerCase();
        let version = match[3] ? match[3].split(',')[0].trim() : '0.0.0';
        version = version.replace(/^[\^~>=< ]+/, '') || '0.0.0';

        packages.push({
          name,
          version,
          ecosystem: 'pypi',
          direct_dependency: true,
          depth: 1
        });
        relationships.push({ source: projectName, target: name });
      }
    }

    return {
      projectName,
      ecosystem: 'pypi',
      packages,
      rawRelationships: relationships
    };
  }

  private parsePyprojectToml(content: string): ParseResult {
    const packages: NormalizedPackage[] = [];
    const projectName = 'python-pyproject';
    const relationships: Array<{ source: string; target: string }> = [];

    // Simple robust regex parsing for dependencies array in pyproject.toml
    const depSectionMatch = content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
    if (depSectionMatch && depSectionMatch[1]) {
      const entries = depSectionMatch[1].split(',');
      for (const entry of entries) {
        const cleanEntry = entry.replace(/["'\r\n\s]/g, '');
        if (!cleanEntry) continue;
        const match = cleanEntry.match(/^([a-zA-Z0-9_\-\.]+)(?:([=><~^!]+)(.*))?$/);
        if (match) {
          const name = match[1].toLowerCase();
          const version = match[3] ? match[3].replace(/^[\^~>=< ]+/, '') : '0.0.0';
          packages.push({
            name,
            version,
            ecosystem: 'pypi',
            direct_dependency: true,
            depth: 1
          });
          relationships.push({ source: projectName, target: name });
        }
      }
    }

    return {
      projectName,
      ecosystem: 'pypi',
      packages,
      rawRelationships: relationships
    };
  }
}
