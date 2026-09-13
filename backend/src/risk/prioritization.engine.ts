import { PackageRiskCalculation, RiskInputPackage } from './risk-model.interface.js';

export interface PrioritizedItem {
  rank: number;
  packageName: string;
  installedVersion: string;
  vulnId: string;
  cveId: string | null;
  severity: number;
  severityRating: string;
  epssScore: number;
  epssPercentile: number;
  dependentsCount: number;
  transitiveDependentsCount: number;
  blastRadiusScore: number;
  packageRiskScore: number;
  fixedVersion: string | null;
  rationale: string[];
}

export class PrioritizationEngine {
  static prioritize(
    packages: RiskInputPackage[],
    packageRisks: Map<string, PackageRiskCalculation>
  ): PrioritizedItem[] {
    const items: PrioritizedItem[] = [];

    for (const pkg of packages) {
      if (pkg.vulnerabilities.length === 0) continue;

      const riskCalc = packageRisks.get(pkg.name);
      const riskScore = riskCalc?.finalRiskScore || 0;

      for (const v of pkg.vulnerabilities) {
        const rationale: string[] = [];

        // Generate human-readable rationale
        if (v.vuln.severity >= 9.0) {
          rationale.push(`Critical severity vulnerability (CVSS ${v.vuln.severity}) with potential for arbitrary code execution.`);
        } else if (v.vuln.severity >= 7.0) {
          rationale.push(`High severity vulnerability (CVSS ${v.vuln.severity}).`);
        }

        if (v.epss.epss >= 0.5) {
          rationale.push(`Very high exploit probability (EPSS ${(v.epss.epss * 100).toFixed(1)}% — top ${((1 - v.epss.percentile) * 100).toFixed(1)}% of all CVEs).`);
        } else if (v.epss.epss >= 0.2) {
          rationale.push(`Elevated exploit probability in the wild (EPSS ${(v.epss.epss * 100).toFixed(1)}%).`);
        }

        if (pkg.metrics.blastRadiusScore >= 70) {
          rationale.push(`High blast radius (${pkg.metrics.blastRadiusScore}/100): affects ${pkg.metrics.transitiveDependents.length} upstream components including root application.`);
        } else if (pkg.metrics.directDependents.length > 0) {
          rationale.push(`Directly impacts ${pkg.metrics.directDependents.length} immediate dependent services: ${pkg.metrics.directDependents.join(', ')}.`);
        }

        if (v.vuln.fixedVersion) {
          rationale.push(`Fix is immediately available: upgrade to ${v.vuln.fixedVersion}.`);
        } else {
          rationale.push(`No direct patch detected; vendor mitigation or perimeter filtering recommended.`);
        }

        items.push({
          rank: 0,
          packageName: pkg.name,
          installedVersion: pkg.version,
          vulnId: v.vuln.vulnId,
          cveId: v.vuln.cveId,
          severity: v.vuln.severity,
          severityRating: v.vuln.severityRating,
          epssScore: v.epss.epss,
          epssPercentile: v.epss.percentile,
          dependentsCount: pkg.metrics.directDependents.length,
          transitiveDependentsCount: pkg.metrics.transitiveDependents.length,
          blastRadiusScore: pkg.metrics.blastRadiusScore,
          packageRiskScore: riskScore,
          fixedVersion: v.vuln.fixedVersion,
          rationale,
        });
      }
    }

    // Sort priority by:
    // 1. Final risk score descending
    // 2. Blast radius descending
    // 3. EPSS descending
    // 4. Severity descending
    items.sort((a, b) => {
      if (b.packageRiskScore !== a.packageRiskScore) return b.packageRiskScore - a.packageRiskScore;
      if (b.blastRadiusScore !== a.blastRadiusScore) return b.blastRadiusScore - a.blastRadiusScore;
      if (b.epssScore !== a.epssScore) return b.epssScore - a.epssScore;
      return b.severity - a.severity;
    });

    // Assign rank 1, 2, 3...
    items.forEach((item, index) => {
      item.rank = index + 1;
    });

    return items;
  }
}
