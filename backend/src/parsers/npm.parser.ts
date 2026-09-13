import { DependencyParser, Ecosystem, NormalizedPackage, ParseResult } from './parser.interface.js';

export class NpmDependencyParser implements DependencyParser {
  ecosystem: Ecosystem = 'npm';
  supportedFiles: string[] = ['package.json', 'package-lock.json'];

  canParse(filename: string): boolean {
    const base = filename.split('/').pop()?.split('\\').pop()?.toLowerCase() || '';
    return this.supportedFiles.includes(base);
  }

  parse(content: string, filename = 'package.json'): ParseResult {
    const isLockfile = filename.toLowerCase().includes('package-lock.json');
    const json = JSON.parse(content);

    if (isLockfile) {
      return this.parseLockfile(json);
    } else {
      return this.parsePackageJson(json);
    }
  }

  private parsePackageJson(json: any): ParseResult {
    const projectName = json.name || 'unnamed-project';
    const packages: NormalizedPackage[] = [];
    const relationships: Array<{ source: string; target: string }> = [];

    const deps = json.dependencies || {};
    const devDeps = json.devDependencies || {};

    const cleanVersion = (v: string) => v.replace(/^[\^~>=< ]+/, '') || '0.0.0';

    for (const [name, versionSpec] of Object.entries(deps)) {
      const v = cleanVersion(String(versionSpec));
      packages.push({
        name,
        version: v,
        ecosystem: 'npm',
        direct_dependency: true,
        depth: 1
      });
      relationships.push({ source: projectName, target: name });
    }

    for (const [name, versionSpec] of Object.entries(devDeps)) {
      if (!deps[name]) {
        const v = cleanVersion(String(versionSpec));
        packages.push({
          name,
          version: v,
          ecosystem: 'npm',
          direct_dependency: true,
          depth: 1
        });
        relationships.push({ source: projectName, target: name });
      }
    }

    return {
      projectName,
      ecosystem: 'npm',
      packages,
      rawRelationships: relationships
    };
  }

  private parseLockfile(json: any): ParseResult {
    const projectName = json.name || 'unnamed-project';
    const packagesMap = new Map<string, NormalizedPackage>();
    const relationships: Array<{ source: string; target: string }> = [];

    const directDeps = new Set<string>();

    // Lockfile v2/v3 has packages[""] as root
    if (json.packages && json.packages['']) {
      const root = json.packages[''];
      const rootDeps = { ...(root.dependencies || {}), ...(root.devDependencies || {}) };
      for (const depName of Object.keys(rootDeps)) {
        directDeps.add(depName);
        relationships.push({ source: projectName, target: depName });
      }
    }

    if (json.packages) {
      // npm lockfile v2/v3 structure
      for (const [pathKey, pkgData] of Object.entries<any>(json.packages)) {
        if (!pathKey || pathKey === '') continue; // Skip root

        // Extract clean package name from node_modules path
        // e.g. "node_modules/auth-service-pkg-a" -> "auth-service-pkg-a"
        // e.g. "node_modules/a/node_modules/c" -> "c"
        const parts = pathKey.split('node_modules/');
        const pkgName = parts[parts.length - 1];
        if (!pkgName) continue;

        const hasRootPackages = Boolean(json.packages && json.packages['']);
        const isDirect = hasRootPackages ? directDeps.has(pkgName) : parts.length === 2;
        const version = pkgData.version || '0.0.0';

        if (!packagesMap.has(pkgName)) {
          packagesMap.set(pkgName, {
            name: pkgName,
            version,
            ecosystem: 'npm',
            direct_dependency: isDirect,
            dependencies: pkgData.dependencies || {}
          });
        }

        // Record child relationships: pkgName -> child
        if (pkgData.dependencies) {
          for (const childName of Object.keys(pkgData.dependencies)) {
            relationships.push({ source: pkgName, target: childName });
          }
        }
      }
    } else if (json.dependencies) {
      // npm lockfile v1 structure
      this.traverseLockfileV1(json.dependencies, projectName, packagesMap, relationships, 1);
    }

    // Ensure direct relationships from root if not explicitly in packages[""]
    for (const pkg of packagesMap.values()) {
      if (pkg.direct_dependency && !relationships.some(r => r.source === projectName && r.target === pkg.name)) {
        relationships.push({ source: projectName, target: pkg.name });
      }
    }

    return {
      projectName,
      ecosystem: 'npm',
      packages: Array.from(packagesMap.values()),
      rawRelationships: relationships
    };
  }

  private traverseLockfileV1(
    depsObj: any,
    parentName: string,
    packagesMap: Map<string, NormalizedPackage>,
    relationships: Array<{ source: string; target: string }>,
    depth: number
  ) {
    for (const [name, data] of Object.entries<any>(depsObj)) {
      relationships.push({ source: parentName, target: name });

      if (!packagesMap.has(name)) {
        packagesMap.set(name, {
          name,
          version: data.version || '0.0.0',
          ecosystem: 'npm',
          direct_dependency: depth === 1,
          depth
        });
      }

      if (data.dependencies) {
        this.traverseLockfileV1(data.dependencies, name, packagesMap, relationships, depth + 1);
      }
    }
  }
}
