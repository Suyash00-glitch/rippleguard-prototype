import { ProjectRiskResult } from '../risk/risk-model.interface.js';
import { PrioritizedItem } from '../risk/prioritization.engine.js';
import { SimulationResult } from '../risk/remediation.simulator.js';

export interface GateCheckResult {
  status: 'PASSED' | 'BLOCKED';
  riskScore: number;
  threshold: number;
  canMerge: boolean;
  markdownComment: string;
  summary: {
    totalDependencies: number;
    vulnerabilitiesCount: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
  topPriorityItem?: PrioritizedItem;
  topSimulation?: SimulationResult;
}

export class GitHubGateService {
  static evaluateGate(
    riskResult: ProjectRiskResult,
    prioritizedItems: PrioritizedItem[],
    simulations: SimulationResult[],
    totalDeps: number
  ): GateCheckResult {
    const isBlocked = riskResult.gateStatus === 'BLOCKED';
    const topItem = prioritizedItems.length > 0 ? prioritizedItems[0] : undefined;
    const topSim = simulations.length > 0 ? simulations[0] : undefined;

    const criticalCount = prioritizedItems.filter(i => i.severityRating === 'CRITICAL').length;
    const highCount = prioritizedItems.filter(i => i.severityRating === 'HIGH').length;
    const mediumCount = prioritizedItems.filter(i => i.severityRating === 'MEDIUM').length;
    const lowCount = prioritizedItems.filter(i => i.severityRating === 'LOW').length;

    const markdownComment = this.generatePRComment({
      isBlocked,
      riskScore: riskResult.overallRiskScore,
      riskLevel: riskResult.riskLevel,
      threshold: riskResult.gateThreshold,
      totalVulns: prioritizedItems.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      topItem,
      topSim,
    });

    return {
      status: isBlocked ? 'BLOCKED' : 'PASSED',
      riskScore: riskResult.overallRiskScore,
      threshold: riskResult.gateThreshold,
      canMerge: !isBlocked,
      markdownComment,
      summary: {
        totalDependencies: totalDeps,
        vulnerabilitiesCount: prioritizedItems.length,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
      },
      topPriorityItem: topItem,
      topSimulation: topSim,
    };
  }

  static generatePRComment(params: {
    isBlocked: boolean;
    riskScore: number;
    riskLevel: string;
    threshold: number;
    totalVulns: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    topItem?: PrioritizedItem;
    topSim?: SimulationResult;
  }): string {
    if (!params.isBlocked) {
      return `## 🛡️ RippleGuard Security Analysis

**Status:** ✅ **PASSED**
**Risk Score:** \`${params.riskScore}/100\` (Threshold: ${params.threshold})

No blocking vulnerabilities or supply-chain risks detected.

| Metric | Value |
| :--- | :--- |
| **Active Vulnerabilities** | ${params.totalVulns} |
| **Risk Level** | \`${params.riskLevel}\` |
| **Merge Recommendation** | ✅ **SAFE TO MERGE** |

*Verified by RippleGuard Contextual Supply-Chain Security Gate.*`;
    }

    // Blocked comment
    let comment = `## 🛡️ RippleGuard Security Analysis

> ⚠️ **Pull Request Merge Gate Blocked**
> The introduced dependency changes exceed the allowed organizational risk threshold (\`${params.riskScore}/100\` vs threshold \`${params.threshold}\`).

### 📊 Risk Summary
- **Status:** ❌ **BLOCKED**
- **Risk Score:** \`${params.riskScore} / 100\`
- **Risk Level:** **${params.riskLevel}**
- **Total Vulnerabilities:** ${params.totalVulns} (🚨 Critical: ${params.criticalCount}, ⚠️ High: ${params.highCount}, ⚡ Medium: ${params.mediumCount})
`;

    if (params.topItem) {
      comment += `
### 🎯 Highest-Priority Vulnerability
- **Package:** \`${params.topItem.packageName}\` (installed: \`${params.topItem.installedVersion}\`)
- **Vulnerability:** \`${params.topItem.cveId || params.topItem.vulnId}\` (CVSS: **${params.topItem.severity}**)
- **Exploit Probability (EPSS):** **${(params.topItem.epssScore * 100).toFixed(1)}%** (percentile: ${(params.topItem.epssPercentile * 100).toFixed(1)}%)
- **Dependents Affected:** **${params.topItem.dependentsCount}** direct / **${params.topItem.transitiveDependentsCount}** transitive
- **Blast Radius Score:** \`${params.topItem.blastRadiusScore}/100\`
`;
    }

    if (params.topSim) {
      comment += `
### 🛠️ Recommended Remediation (Simulated)
- **Action:** Upgrade \`${params.topSim.packageName}\` from \`${params.topSim.currentVersion}\` → **\`${params.topSim.recommendedVersion}\`**
- **Estimated Risk Reduction:** \`${params.topSim.currentRiskScore}\` → \`${params.topSim.simulatedRiskScore}\` (**-${params.topSim.riskReductionPercent}%**)
- **Expected Outcome:** ${params.topSim.prRecommendation === 'SAFE TO MERGE' ? '✅ **PR becomes eligible to merge**' : '⚠️ Reduces risk, but further patches required'}

> *Note: Estimated risk reduction is a simulated calculation based on dependency topology and disclosure metadata.*
`;
    }

    comment += `
---
### 🔒 Merge Decision
**Recommendation:** ❌ **DO NOT MERGE** until high-risk dependencies are upgraded or risk score falls below \`${params.threshold}\`.`;

    return comment;
  }
}
