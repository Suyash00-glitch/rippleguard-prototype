import { DEMO_VULNERABILITIES } from './mock-data.js';

export interface NormalizedVulnerability {
  vulnId: string;
  cveId: string | null;
  title: string;
  summary: string;
  details: string;
  severity: number; // CVSS base score 0-10
  severityRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedVersions: string;
  fixedVersion: string | null;
  publishedDate: Date | null;
  modifiedDate: Date | null;
  references: string[];
}

function compareSemver(v1: string, v2: string): number {
  const parse = (v: string) => v.replace(/^[^0-9]*/, '').split('.').map(n => parseInt(n, 10) || 0);
  const p1 = parse(v1);
  const p2 = parse(v2);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export class OsvClient {
  private baseUrl: string;
  private cache: Map<string, NormalizedVulnerability[]> = new Map();

  constructor(baseUrl = process.env.OSV_API_URL || 'https://api.osv.dev/v1') {
    this.baseUrl = baseUrl;
  }

  private mapEcosystem(ecosystem: string): string {
    switch (ecosystem.toLowerCase()) {
      case 'npm': return 'npm';
      case 'pypi': return 'PyPI';
      case 'maven': return 'Maven';
      case 'golang': return 'Go';
      default: return ecosystem;
    }
  }

  async queryPackage(name: string, version: string, ecosystem: string, isDemo = false): Promise<NormalizedVulnerability[]> {
    const cacheKey = `${ecosystem}:${name}@${version}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Check deterministic demo definition first if demo mode is requested
    const ecoKey = ecosystem.toLowerCase();
    if (isDemo && DEMO_VULNERABILITIES[ecoKey]?.[name]) {
      const demoVulns = DEMO_VULNERABILITIES[ecoKey][name]
        .filter(d => {
          if (d.fixedVersion && compareSemver(version, d.fixedVersion) >= 0) {
            return false; // Package version is >= fixed version, NOT affected!
          }
          return true;
        })
        .map(d => ({
        vulnId: d.vulnId,
        cveId: d.cveId,
        title: d.title,
        summary: d.summary,
        details: d.summary,
        severity: d.severity,
        severityRating: d.severityRating,
        affectedVersions: d.affectedVersions,
        fixedVersion: d.fixedVersion,
        publishedDate: new Date(d.publishedDate),
        modifiedDate: new Date(d.publishedDate),
        references: ['https://osv.dev/vulnerability/' + d.vulnId],
      }));
      this.cache.set(cacheKey, demoVulns);
      return demoVulns;
    }

    try {
      const response = await fetch(`${this.baseUrl}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package: {
            name,
            ecosystem: this.mapEcosystem(ecosystem),
          },
          version,
        }),
        signal: AbortSignal.timeout(6000), // 6 sec timeout
      });

      if (!response.ok) {
        throw new Error(`OSV API HTTP ${response.status}`);
      }

      const data: any = await response.json();
      const vulns: any[] = data.vulns || [];

      const normalized: NormalizedVulnerability[] = vulns.map(v => this.normalizeOsv(v, version));
      this.cache.set(cacheKey, normalized);
      return normalized;
    } catch (err: any) {
      console.warn(`[OSV Warning] Failed querying ${name}@${version}: ${err.message}. Using fallback.`);
      
      // Fallback check in demo data
      if (DEMO_VULNERABILITIES[ecoKey]?.[name]) {
        const demoVulns = DEMO_VULNERABILITIES[ecoKey][name]
          .filter(d => {
            if (d.fixedVersion && compareSemver(version, d.fixedVersion) >= 0) {
              return false;
            }
            return true;
          })
          .map(d => ({
          vulnId: d.vulnId,
          cveId: d.cveId,
          title: d.title,
          summary: d.summary,
          details: d.summary,
          severity: d.severity,
          severityRating: d.severityRating,
          affectedVersions: d.affectedVersions,
          fixedVersion: d.fixedVersion,
          publishedDate: new Date(d.publishedDate),
          modifiedDate: new Date(d.publishedDate),
          references: ['https://osv.dev/vulnerability/' + d.vulnId],
        }));
        this.cache.set(cacheKey, demoVulns);
        return demoVulns;
      }

      return [];
    }
  }

  private normalizeOsv(v: any, installedVersion: string): NormalizedVulnerability {
    // Extract CVE
    const cveId = (v.aliases || []).find((a: string) => a.startsWith('CVE-')) || (v.id.startsWith('CVE-') ? v.id : null);

    // Extract CVSS score
    let severity = 5.0; // default moderate
    if (v.severity && Array.isArray(v.severity)) {
      const cvss = v.severity.find((s: any) => s.type === 'CVSS_V3');
      if (cvss && cvss.score) {
        // Can be score string or vector string
        const match = cvss.score.match(/CVSS:3\.[01]\/.*\/S:[U|C]\/C:[N|L|H]\/I:[N|L|H]\/A:[N|L|H]/);
        // Or if direct number
        const num = parseFloat(cvss.score);
        if (!isNaN(num)) severity = num;
      }
    }

    // Determine fixed version from ranges
    let fixedVersion: string | null = null;
    let affectedVersions = '';
    if (v.affected && Array.isArray(v.affected)) {
      for (const aff of v.affected) {
        if (aff.ranges && Array.isArray(aff.ranges)) {
          for (const r of aff.ranges) {
            if (r.events && Array.isArray(r.events)) {
              for (const e of r.events) {
                if (e.fixed) {
                  fixedVersion = e.fixed;
                  break;
                }
              }
            }
          }
        }
      }
    }

    // Rating determination
    let severityRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (severity >= 9.0) severityRating = 'CRITICAL';
    else if (severity >= 7.0) severityRating = 'HIGH';
    else if (severity >= 4.0) severityRating = 'MEDIUM';

    return {
      vulnId: v.id,
      cveId,
      title: v.summary || v.id,
      summary: v.summary || 'No summary available',
      details: v.details || '',
      severity,
      severityRating,
      affectedVersions: affectedVersions || installedVersion,
      fixedVersion,
      publishedDate: v.published ? new Date(v.published) : null,
      modifiedDate: v.modified ? new Date(v.modified) : null,
      references: (v.references || []).map((r: any) => r.url || ''),
    };
  }
}
