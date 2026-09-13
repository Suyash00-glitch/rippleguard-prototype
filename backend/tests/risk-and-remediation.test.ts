import { describe, it, expect } from 'vitest';
import { RuleBasedRiskModel } from '../src/risk/rule-based.model.js';
import { RemediationSimulator } from '../src/risk/remediation.simulator.js';
import { RiskInputPackage } from '../src/risk/risk-model.interface.js';

describe('Risk Engine, Attenuation, and Remediation Simulator', () => {
  const sampleRelationships = [
    { source: 'App', target: 'pkg-a' },
    { source: 'App', target: 'pkg-b' },
    { source: 'pkg-a', target: 'pkg-c' },
    { source: 'pkg-b', target: 'pkg-c' },
  ];

  it('evaluates safe project with LOW risk score and PASSED gate', () => {
    const riskModel = new RuleBasedRiskModel();
    const safePackages: RiskInputPackage[] = [
      {
        name: 'pkg-a',
        version: '1.0.0',
        ecosystem: 'npm',
        isDirect: true,
        depth: 1,
        metrics: {
          depth: 1,
          inDegree: 1,
          outDegree: 1,
          directDependents: ['App'],
          transitiveDependents: ['App'],
          dependencies: ['pkg-c'],
          transitiveDependencies: ['pkg-c'],
          downstreamPathsCount: 1,
          blastRadiusScore: 20,
          centralityScore: 0.1,
          reachableNodesCount: 1,
        },
        vulnerabilities: [],
      },
    ];

    const result = riskModel.calculateRisk(safePackages, [{ source: 'App', target: 'pkg-a' }], 70.0);
    expect(result.overallRiskScore).toBe(0);
    expect(result.riskLevel).toBe('LOW');
    expect(result.gateStatus).toBe('PASSED');
  });

  it('calculates high contextual risk and BLOCKED gate for vulnerable shared package', () => {
    const riskModel = new RuleBasedRiskModel();
    const packages: RiskInputPackage[] = [
      {
        name: 'pkg-a',
        version: '1.0.0',
        ecosystem: 'npm',
        isDirect: true,
        depth: 1,
        metrics: {
          depth: 1,
          inDegree: 1,
          outDegree: 1,
          directDependents: ['App'],
          transitiveDependents: ['App'],
          dependencies: ['pkg-c'],
          transitiveDependencies: ['pkg-c'],
          downstreamPathsCount: 1,
          blastRadiusScore: 30,
          centralityScore: 0.2,
          reachableNodesCount: 1,
        },
        vulnerabilities: [],
      },
      {
        name: 'pkg-b',
        version: '1.2.0',
        ecosystem: 'npm',
        isDirect: true,
        depth: 1,
        metrics: {
          depth: 1,
          inDegree: 1,
          outDegree: 1,
          directDependents: ['App'],
          transitiveDependents: ['App'],
          dependencies: ['pkg-c'],
          transitiveDependencies: ['pkg-c'],
          downstreamPathsCount: 1,
          blastRadiusScore: 30,
          centralityScore: 0.2,
          reachableNodesCount: 1,
        },
        vulnerabilities: [],
      },
      {
        name: 'pkg-c',
        version: '2.1.0',
        ecosystem: 'npm',
        isDirect: false,
        depth: 2,
        metrics: {
          depth: 2,
          inDegree: 2,
          outDegree: 0,
          directDependents: ['pkg-a', 'pkg-b'],
          transitiveDependents: ['pkg-a', 'pkg-b', 'App'],
          dependencies: [],
          transitiveDependencies: [],
          downstreamPathsCount: 2,
          blastRadiusScore: 85,
          centralityScore: 0.4,
          reachableNodesCount: 0,
        },
        vulnerabilities: [
          {
            vuln: {
              vulnId: 'GHSA-demo-c210',
              cveId: 'CVE-2024-8891',
              title: 'Critical RCE in crypto-core',
              summary: 'Remote Code Execution',
              details: 'RCE details',
              severity: 9.8,
              severityRating: 'CRITICAL',
              affectedVersions: '>=2.0.0 <2.4.0',
              fixedVersion: '2.4.0',
              publishedDate: new Date(),
              modifiedDate: new Date(),
              references: [],
            },
            epss: {
              cve: 'CVE-2024-8891',
              epss: 0.87,
              percentile: 0.96,
              isFallback: false,
            },
          },
        ],
      },
    ];

    const result = riskModel.calculateRisk(packages, sampleRelationships, 70.0);
    expect(result.overallRiskScore).toBeGreaterThanOrEqual(70);
    expect(['CRITICAL', 'VERY_HIGH']).toContain(result.riskLevel);
    expect(result.gateStatus).toBe('BLOCKED');

    // Check upstream propagation: pkg-a and pkg-b should receive propagated risk from pkg-c
    const pkgACalc = result.packageRisks.get('pkg-a')!;
    expect(pkgACalc.propagatedRisk).toBeGreaterThan(0);
    expect(pkgACalc.finalRiskScore).toBeLessThanOrEqual(100);

    // Now test remediation simulation: simulate upgrading pkg-c to 2.4.0
    const sim = RemediationSimulator.simulatePatch(
      'pkg-c',
      '2.4.0',
      packages,
      sampleRelationships,
      result.overallRiskScore,
      70.0
    );

    expect(sim.simulatedRiskScore).toBeLessThan(result.overallRiskScore);
    expect(sim.riskReductionPoints).toBeGreaterThan(0);
    expect(sim.riskReductionPercent).toBeGreaterThan(40);
    expect(sim.prRecommendation).toBe('SAFE TO MERGE');
    expect(sim.disclaimer).toContain('Estimated risk reduction');
  });
});
