import { DependencyGraph } from '../graph/dependency-graph.js';
import { RuleBasedRiskModel } from './rule-based.model.js';
import { RiskInputPackage } from './risk-model.interface.js';

export interface SimulationResult {
  packageName: string;
  currentVersion: string;
  recommendedVersion: string;
  currentRiskScore: number;
  simulatedRiskScore: number;
  riskReductionPoints: number;
  riskReductionPercent: number;
  rationale: string[];
  prRecommendation: 'SAFE TO MERGE' | 'STILL BLOCKED';
  disclaimer: string;
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

export class RemediationSimulator {
  static simulatePatch(
    targetPackage: string,
    recommendedVersion: string,
    currentPackages: RiskInputPackage[],
    relationships: Array<{ source: string; target: string }>,
    currentProjectRisk: number,
    threshold = 70.0
  ): SimulationResult {
    const riskModel = new RuleBasedRiskModel();
    let isFixed = false;
    const targetPkg = currentPackages.find(p => p.name === targetPackage);

    // Clone packages and check if recommendedVersion actually fixes vulnerabilities
    const simulatedPackages: RiskInputPackage[] = currentPackages.map(pkg => {
      if (pkg.name === targetPackage) {
        // Filter out vulnerabilities that are resolved by recommendedVersion
        const remainingVulns = pkg.vulnerabilities.filter(v => {
          const fixedVer = v.vuln.fixedVersion;
          if (!fixedVer) return true; // no patch known
          // If recommendedVersion >= fixedVer, vulnerability is fixed!
          return compareSemver(recommendedVersion, fixedVer) < 0;
        });

        if (remainingVulns.length < pkg.vulnerabilities.length) {
          isFixed = true;
        }

        return {
          ...pkg,
          version: recommendedVersion,
          vulnerabilities: remainingVulns,
        };
      }
      return { ...pkg };
    });

    // Rebuild graph to recalculate depths and blast radii
    const simGraph = new DependencyGraph();
    for (const pkg of simulatedPackages) {
      simGraph.addNode({
        id: pkg.name,
        name: pkg.name,
        version: pkg.version,
        ecosystem: pkg.ecosystem,
        isDirect: pkg.isDirect,
        depth: pkg.depth,
      });
    }
    for (const rel of relationships) {
      simGraph.addEdge(rel.source, rel.target);
    }
    const simMetrics = simGraph.calculateAllMetrics();

    for (const pkg of simulatedPackages) {
      const m = simMetrics.get(pkg.name);
      if (m) {
        pkg.metrics = m;
        pkg.depth = m.depth;
      }
    }

    let simulatedRiskScore = currentProjectRisk;
    let riskReductionPoints = 0;
    let riskReductionPercent = 0;
    let prRecommendation: 'SAFE TO MERGE' | 'STILL BLOCKED' = 'STILL BLOCKED';

    if (isFixed) {
      const simRiskResult = riskModel.calculateRisk(simulatedPackages, relationships, threshold);
      simulatedRiskScore = simRiskResult.overallRiskScore;
      riskReductionPoints = Math.max(0, Math.round((currentProjectRisk - simulatedRiskScore) * 10) / 10);
      riskReductionPercent = currentProjectRisk > 0
        ? Math.round((riskReductionPoints / currentProjectRisk) * 1000) / 10
        : 0;
      prRecommendation = simulatedRiskScore < threshold ? 'SAFE TO MERGE' : 'STILL BLOCKED';
    } else {
      simulatedRiskScore = currentProjectRisk;
      riskReductionPoints = 0;
      riskReductionPercent = 0;
      prRecommendation = 'STILL BLOCKED';
    }

    const rationale: string[] = [];
    if (isFixed) {
      rationale.push(`Version ${recommendedVersion} successfully resolves active vulnerabilities (fixed in ${targetPkg?.vulnerabilities[0]?.vuln.fixedVersion || recommendedVersion}).`);
      rationale.push(`Eliminates security risk spreading to ${targetPkg?.metrics.directDependents.length || 0} dependent libraries.`);
      rationale.push(`Risk drops from ${currentProjectRisk} down to ${simulatedRiskScore} (-${riskReductionPercent}%).`);
      if (prRecommendation === 'SAFE TO MERGE') {
        rationale.push(`Brings PR risk below the ${threshold} safety limit. Pull Request is now SAFE TO MERGE!`);
      }
    } else {
      const neededFix = targetPkg?.vulnerabilities[0]?.vuln.fixedVersion || '2.4.0';
      rationale.push(`Version ${recommendedVersion} is still vulnerable! (The security flaw affects all versions below ${neededFix}).`);
      rationale.push(`Danger score remains at ${simulatedRiskScore} / 100.`);
      rationale.push(`You must upgrade to version ${neededFix} or higher to resolve this issue.`);
    }

    return {
      packageName: targetPackage,
      currentVersion: targetPkg?.version || '1.0.0',
      recommendedVersion,
      currentRiskScore: currentProjectRisk,
      simulatedRiskScore,
      riskReductionPoints,
      riskReductionPercent,
      rationale,
      prRecommendation,
      disclaimer: 'Estimated risk reduction — simulated impact based on dependency topology and current vulnerability disclosure data.',
    };
  }
}
