import { describe, it, expect } from 'vitest';
import { GitHubGateService } from '../src/services/github-gate.service.js';
import { ProjectRiskResult } from '../src/risk/risk-model.interface.js';
import { PrioritizedItem } from '../src/risk/prioritization.engine.js';
import { SimulationResult } from '../src/risk/remediation.simulator.js';

describe('GitHub Gate Decision & PR Comment Generator', () => {
  const mockRiskResultBlocked: ProjectRiskResult = {
    overallRiskScore: 87.0,
    riskLevel: 'CRITICAL',
    packageRisks: new Map(),
    aggregatedContributions: {
      severityContribution: 34.3,
      epssContribution: 21.8,
      dependencyImpactContribution: 15.0,
      blastRadiusContribution: 17.0,
      propagationContribution: 0,
      fixFactorContribution: 5.0,
    },
    gateStatus: 'BLOCKED',
    gateThreshold: 70.0,
    modelType: 'RuleBasedContextualRiskModel-v1',
  };

  const mockTopItem: PrioritizedItem = {
    rank: 1,
    packageName: 'crypto-core-pkg-c',
    installedVersion: '2.1.0',
    vulnId: 'GHSA-demo-c210',
    cveId: 'CVE-2024-8891',
    severity: 9.8,
    severityRating: 'CRITICAL',
    epssScore: 0.87,
    epssPercentile: 0.96,
    dependentsCount: 2,
    transitiveDependentsCount: 3,
    blastRadiusScore: 85,
    packageRiskScore: 91,
    fixedVersion: '2.4.0',
    rationale: ['Critical RCE', 'High exploit probability'],
  };

  const mockSimulation: SimulationResult = {
    packageName: 'crypto-core-pkg-c',
    currentVersion: '2.1.0',
    recommendedVersion: '2.4.0',
    currentRiskScore: 87.0,
    simulatedRiskScore: 43.0,
    riskReductionPoints: 44.0,
    riskReductionPercent: 50.6,
    rationale: ['Resolves RCE', 'Reduces risk below threshold'],
    prRecommendation: 'SAFE TO MERGE',
    disclaimer: 'Estimated risk reduction',
  };

  it('blocks merge when risk >= threshold and formats markdown comment with fix recommendation', () => {
    const gate = GitHubGateService.evaluateGate(
      mockRiskResultBlocked,
      [mockTopItem],
      [mockSimulation],
      5
    );

    expect(gate.status).toBe('BLOCKED');
    expect(gate.canMerge).toBe(false);
    expect(gate.riskScore).toBe(87.0);
    expect(gate.markdownComment).toContain('BLOCKED');
    expect(gate.markdownComment).toContain('87 / 100');
    expect(gate.markdownComment).toContain('DO NOT MERGE');
    expect(gate.markdownComment).toContain('crypto-core-pkg-c');
    expect(gate.markdownComment).toContain('2.4.0');
    expect(gate.markdownComment).toContain('-50.6%');
  });

  it('allows merge when risk < threshold', () => {
    const mockRiskResultPassed: ProjectRiskResult = {
      ...mockRiskResultBlocked,
      overallRiskScore: 43.0,
      riskLevel: 'MEDIUM',
      gateStatus: 'PASSED',
    };

    const gate = GitHubGateService.evaluateGate(
      mockRiskResultPassed,
      [],
      [],
      5
    );

    expect(gate.status).toBe('PASSED');
    expect(gate.canMerge).toBe(true);
    expect(gate.markdownComment).toContain('PASSED');
    expect(gate.markdownComment).toContain('SAFE TO MERGE');
  });
});
