import { DependencyParser, Ecosystem, NormalizedPackage, ParseResult } from './parser.interface.js';

export class MavenDependencyParser implements DependencyParser {
  ecosystem: Ecosystem = 'maven';
  supportedFiles: string[] = ['pom.xml'];

  canParse(filename: string): boolean {
    const base = filename.split('/').pop()?.split('\\').pop()?.toLowerCase() || '';
    return this.supportedFiles.includes(base);
  }

  parse(content: string, filename = 'pom.xml'): ParseResult {
    const packages: NormalizedPackage[] = [];
    const projectName = 'maven-project';
    const relationships: Array<{ source: string; target: string }> = [];

    // Extract dependencies via regex without requiring heavy XML libraries
    const depRegex = /<dependency>([\s\S]*?)<\/dependency>/g;
    let match: RegExpExecArray | null;

    while ((match = depRegex.exec(content)) !== null) {
      const block = match[1];
      const groupId = block.match(/<groupId>([\s\S]*?)<\/groupId>/)?.[1]?.trim() || '';
      const artifactId = block.match(/<artifactId>([\s\S]*?)<\/artifactId>/)?.[1]?.trim() || '';
      const version = block.match(/<version>([\s\S]*?)<\/version>/)?.[1]?.trim() || '0.0.0';

      if (artifactId) {
        const fullName = groupId ? `${groupId}:${artifactId}` : artifactId;
        packages.push({
          name: fullName,
          version: version.replace(/^\${.*}$/, '1.0.0'), // fallback for maven variables
          ecosystem: 'maven',
          direct_dependency: true,
          depth: 1
        });
        relationships.push({ source: projectName, target: fullName });
      }
    }

    return {
      projectName,
      ecosystem: 'maven',
      packages,
      rawRelationships: relationships
    };
  }
}
