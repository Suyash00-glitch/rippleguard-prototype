export interface ResolvedDependency {
  name: string;
  version: string;
  dependencies: Array<{ name: string; version: string }>;
}

export class DepsDevClient {
  private baseUrl: string;
  private cache: Map<string, ResolvedDependency> = new Map();

  constructor(baseUrl = process.env.DEPSDEV_API_URL || 'https://api.deps.dev/v3') {
    this.baseUrl = baseUrl;
  }

  private mapSystem(ecosystem: string): string {
    switch (ecosystem.toLowerCase()) {
      case 'npm': return 'npm';
      case 'pypi': return 'pypi';
      case 'maven': return 'maven';
      case 'golang': return 'go';
      default: return ecosystem;
    }
  }

  async resolveTransitive(name: string, version: string, ecosystem: string): Promise<ResolvedDependency | null> {
    const key = `${ecosystem}:${name}@${version}`;
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    try {
      const system = this.mapSystem(ecosystem);
      const url = `${this.baseUrl}/systems/${system}/packages/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(4000),
      });

      if (!response.ok) {
        return null;
      }

      const data: any = await response.json();
      const deps: Array<{ name: string; version: string }> = [];

      if (data.links) {
        for (const link of data.links) {
          if (link.packageKey) {
            deps.push({
              name: link.packageKey.name,
              version: link.versionKey?.version || '0.0.0',
            });
          }
        }
      }

      const resolved: ResolvedDependency = {
        name,
        version,
        dependencies: deps,
      };

      this.cache.set(key, resolved);
      return resolved;
    } catch {
      // Graceful fallback to local dependency extraction without blocking
      return null;
    }
  }
}
