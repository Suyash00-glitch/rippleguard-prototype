import {
  PackageRiskCalculation,
  ProjectRiskResult,
  RiskContributions,
  RiskInputPackage,
  RiskLevel,
  RiskModel,
  RiskWeights,
} from './risk-model.interface.js';

export const DEFAULT_RISK_WEIGHTS: RiskWeights = {
  severityWeight: 0.35,
  epssWeight: 0.25,
  blastRadiusWeight: 0.20,
  depthWeight: 0.10,
  centralityWeight: 0.10,
  fixDiscount: 5.0,
  attenuationFactor: 0.70,
};

export class RuleBasedRiskModel implements RiskModel {
  name = 'RuleBasedContextualRiskModel-v1';
  version = '1.0.0-prototype';
  private weights: RiskWeights;

  constructor(weights: Partial<RiskWeights> = {}) {
    this.weights = { ...DEFAULT_RISK_WEIGHTS, ...weights };
  }

  static getRiskLevel(score: number): RiskLevel {
    if (score >= 85) return 'CRITICAL';
    if (score >= 70) return 'VERY_HIGH';
    if (score >= 50) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
  }

  calculateRisk(
    packages: RiskInputPackage[],
    relationships: Array<{ source: string; target: string }>,
    threshold = 70.0
  ): ProjectRiskResult {
    const packageRisks = new Map<string, PackageRiskCalculation>();

    // Step 1: Calculate direct/base risk for each package
    for (const pkg of packages) {
      if (pkg.vulnerabilities.length === 0) {
        packageRisks.set(pkg.name, {
          packageName: pkg.name,
          baseVulnerabilityRisk: 0,
          blastRadiusRisk: 0,
          propagatedRisk: 0,
          finalRiskScore: 0,
          contributions: {
            severityContribution: 0,
            epssContribution: 0,
            dependencyImpactContribution: 0,
            blastRadiusContribution: 0,
            propagationContribution: 0,
            fixFactorContribution: 0,
          },
        });
        continue;
      }

      // Max CVSS across vulnerabilities (scaled to 0-100)
      const maxCvss = Math.max(...pkg.vulnerabilities.map(v => v.vuln.severity || 0)) * 10;
      // Max EPSS (scaled to 0-100)
      const maxEpss = Math.max(...pkg.vulnerabilities.map(v => (v.epss?.epss || 0.05))) * 100;
      // Blast radius score (0-100)
      const blastScore = pkg.metrics.blastRadiusScore || 0;
      // Depth impact: direct dependencies (depth 1) pose immediate exposure (100 pts), deeper dependencies attenuate
      const depthScore = pkg.depth <= 1 ? 100 : Math.max(20, 100 - (pkg.depth - 1) * 25);
      // Centrality impact (0-100)
      const centralityScore = Math.min(100, (pkg.metrics.centralityScore || 0) * 100);
      // Check fix availability
      const hasFix = pkg.vulnerabilities.some(v => !!v.vuln.fixedVersion);
      const fixFactor = hasFix ? this.weights.fixDiscount : 0;

      const sevContrib = maxCvss * this.weights.severityWeight;
      const epssContrib = maxEpss * this.weights.epssWeight;
      const blastContrib = blastScore * this.weights.blastRadiusWeight;
      const depthContrib = depthScore * this.weights.depthWeight;
      const centContrib = centralityScore * this.weights.centralityWeight;

      let baseRisk = sevContrib + epssContrib + blastContrib + depthContrib + centContrib - fixFactor;
      baseRisk = Math.max(0, Math.min(100, Math.round(baseRisk * 10) / 10));

      packageRisks.set(pkg.name, {
        packageName: pkg.name,
        baseVulnerabilityRisk: baseRisk,
        blastRadiusRisk: blastScore,
        propagatedRisk: 0,
        finalRiskScore: baseRisk,
        contributions: {
          severityContribution: Math.round(sevContrib * 10) / 10,
          epssContribution: Math.round(epssContrib * 10) / 10,
          dependencyImpactContribution: Math.round((depthContrib + centContrib) * 10) / 10,
          blastRadiusContribution: Math.round(blastContrib * 10) / 10,
          propagationContribution: 0,
          fixFactorContribution: Math.round(fixFactor * 10) / 10,
        },
      });
    }

    // Step 2: Propagate risk through dependency graph
    // Convention: A -> B means "A depends on B".
    // If B has risk, it propagates upstream to A with attenuation factor alpha.
    const reverseAdjacency = new Map<string, string[]>(); // target (child) -> list of sources (parents/dependents)
    for (const rel of relationships) {
      if (!reverseAdjacency.has(rel.target)) {
        reverseAdjacency.set(rel.target, []);
      }
      reverseAdjacency.get(rel.target)!.push(rel.source);
    }

    // Topological/breadth propagation from leaves to root
    const queue: Array<{ node: string; propagatedScore: number; hop: number }> = [];
    for (const [pkgName, calc] of packageRisks.entries()) {
      if (calc.baseVulnerabilityRisk > 0) {
        queue.push({ node: pkgName, propagatedScore: calc.baseVulnerabilityRisk, hop: 0 });
      }
    }

    const propagatedImpactMap = new Map<string, number>();

    while (queue.length > 0) {
      const { node, propagatedScore, hop } = queue.shift()!;
      if (hop >= 5) continue; // safety limit

      const parents = reverseAdjacency.get(node) || [];
      for (const parent of parents) {
        const attenuated = propagatedScore * this.weights.attenuationFactor;
        const currentImpact = propagatedImpactMap.get(parent) || 0;
        if (attenuated > currentImpact) {
          propagatedImpactMap.set(parent, Math.round(attenuated * 10) / 10);
          queue.push({ node: parent, propagatedScore: attenuated, hop: hop + 1 });
        }
      }
    }

    // Apply propagated risk to package records
    for (const [pkgName, impact] of propagatedImpactMap.entries()) {
      const existing = packageRisks.get(pkgName);
      if (existing) {
        existing.propagatedRisk = impact;
        // Final score combines original vulnerability risk and upstream impact, capped at 100
        existing.finalRiskScore = Math.min(100, Math.max(existing.baseVulnerabilityRisk, impact));
        existing.contributions.propagationContribution = Math.round(impact * 10) / 10;
      }
    }

    // Step 3: Compute Project Overall Risk Score
    const allScores = Array.from(packageRisks.values())
      .map(p => p.finalRiskScore)
      .sort((a, b) => b - a);

    let overallRiskScore = 0;
    if (allScores.length > 0 && allScores[0] > 0) {
      // The security gate risk is determined by the highest risk vulnerability (weakest link in supply chain)
      overallRiskScore = Math.min(100, Math.round(allScores[0] * 10) / 10);
    }

    // Aggregate contributions for project-level breakdown
    const aggregatedContributions: RiskContributions = {
      severityContribution: 0,
      epssContribution: 0,
      dependencyImpactContribution: 0,
      blastRadiusContribution: 0,
      propagationContribution: 0,
      fixFactorContribution: 0,
    };

    let count = 0;
    for (const p of packageRisks.values()) {
      if (p.finalRiskScore > 0) {
        aggregatedContributions.severityContribution += p.contributions.severityContribution;
        aggregatedContributions.epssContribution += p.contributions.epssContribution;
        aggregatedContributions.dependencyImpactContribution += p.contributions.dependencyImpactContribution;
        aggregatedContributions.blastRadiusContribution += p.contributions.blastRadiusContribution;
        aggregatedContributions.propagationContribution += p.contributions.propagationContribution;
        aggregatedContributions.fixFactorContribution += p.contributions.fixFactorContribution;
        count++;
      }
    }

    if (count > 0) {
      aggregatedContributions.severityContribution = Math.round((aggregatedContributions.severityContribution / count) * 10) / 10;
      aggregatedContributions.epssContribution = Math.round((aggregatedContributions.epssContribution / count) * 10) / 10;
      aggregatedContributions.dependencyImpactContribution = Math.round((aggregatedContributions.dependencyImpactContribution / count) * 10) / 10;
      aggregatedContributions.blastRadiusContribution = Math.round((aggregatedContributions.blastRadiusContribution / count) * 10) / 10;
      aggregatedContributions.propagationContribution = Math.round((aggregatedContributions.propagationContribution / count) * 10) / 10;
      aggregatedContributions.fixFactorContribution = Math.round((aggregatedContributions.fixFactorContribution / count) * 10) / 10;
    }

    const riskLevel = RuleBasedRiskModel.getRiskLevel(overallRiskScore);
    const gateStatus = overallRiskScore >= threshold ? 'BLOCKED' : 'PASSED';

    return {
      overallRiskScore,
      riskLevel,
      packageRisks,
      aggregatedContributions,
      gateStatus,
      gateThreshold: threshold,
      modelType: this.name,
    };
  }
}
