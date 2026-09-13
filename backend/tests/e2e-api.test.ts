import { describe, it, expect } from 'vitest';
import { AnalysisService } from '../src/services/analysis.service.js';
import fs from 'fs';
import path from 'path';

describe('End-to-End Pipeline & Canonical Demo Analysis', () => {
  it('runs complete analysis pipeline on canonical vulnerable project', async () => {
    const analysisService = new AnalysisService();
    const demoLockPath = path.resolve(__dirname, '../../examples/vulnerable-project/package-lock.json');
    const content = fs.readFileSync(demoLockPath, 'utf-8');

    const result = await analysisService.runAnalysis({
      projectName: 'Canonical Vulnerable DAG App',
      repoUrl: 'https://github.com/example/vulnerable-dag',
      filename: 'package-lock.json',
      content,
      branch: 'feature/risky-crypto',
      prNumber: 42,
      threshold: 70.0,
      isDemo: true,
    });

    expect(result.analysisId).toBeDefined();
    expect(result.overallRiskScore).toBeGreaterThanOrEqual(70);
    expect(result.gateResult.status).toBe('BLOCKED');
    expect(result.gateResult.canMerge).toBe(false);

    // Verify prioritized item is crypto-core-pkg-c
    expect(result.prioritizedItems.length).toBeGreaterThan(0);
    expect(result.prioritizedItems[0].packageName).toBe('crypto-core-pkg-c');
    expect(result.prioritizedItems[0].fixedVersion).toBe('2.4.0');

    // Verify simulated remediation
    expect(result.simulations.length).toBeGreaterThan(0);
    const cryptoSim = result.simulations.find(s => s.packageName === 'crypto-core-pkg-c');
    expect(cryptoSim).toBeDefined();
    expect(cryptoSim?.simulatedRiskScore).toBeLessThan(result.overallRiskScore);
    expect(cryptoSim?.riskReductionPercent).toBeGreaterThan(40);
    expect(cryptoSim?.prRecommendation).toBe('SAFE TO MERGE');

    // Verify database retrieval
    const dbAnalysis = await analysisService.getAnalysisById(result.analysisId);
    expect(dbAnalysis).toBeDefined();
    expect(dbAnalysis?.packages.length).toBe(result.totalDependencies);
    expect(dbAnalysis?.remediations.length).toBe(result.simulations.length);

    // Verify graph structure for React Flow
    const graphData = await analysisService.getGraph(result.analysisId);
    expect(graphData).toBeDefined();
    expect(graphData?.nodes.length).toBeGreaterThan(0);
    expect(graphData?.edges.length).toBeGreaterThan(0);
  });
});
