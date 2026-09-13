import { NormalizedVulnerability } from '../external/osv.client.js';
import { EpssResult } from '../external/epss.client.js';
import { PackageGraphMetrics } from '../graph/dependency-graph.js';

export interface RiskInputPackage {
  name: string;
  version: string;
  ecosystem: string;
  isDirect: boolean;
  depth: number;
  metrics: PackageGraphMetrics;
  vulnerabilities: Array<{
    vuln: NormalizedVulnerability;
    epss: EpssResult;
  }>;
}

export interface RiskContributions {
  severityContribution: number;
  epssContribution: number;
  dependencyImpactContribution: number;
  blastRadiusContribution: number;
  propagationContribution: number;
  fixFactorContribution: number;
}

export interface PackageRiskCalculation {
  packageName: string;
  baseVulnerabilityRisk: number; // 0 - 100
  blastRadiusRisk: number;       // 0 - 100
  propagatedRisk: number;        // 0 - 100
  finalRiskScore: number;        // 0 - 100
  contributions: RiskContributions;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' | 'CRITICAL';

export interface ProjectRiskResult {
  overallRiskScore: number;      // 0 - 100
  riskLevel: RiskLevel;
  packageRisks: Map<string, PackageRiskCalculation>;
  aggregatedContributions: RiskContributions;
  gateStatus: 'PASSED' | 'BLOCKED';
  gateThreshold: number;
  modelType: string;
}

export interface RiskWeights {
  severityWeight: number;    // default 0.35
  epssWeight: number;        // default 0.25
  blastRadiusWeight: number; // default 0.20
  depthWeight: number;       // default 0.10
  centralityWeight: number;  // default 0.10
  fixDiscount: number;       // discount if fix available, default 5 points
  attenuationFactor: number; // propagation attenuation per hop, default 0.70
}

export interface RiskModel {
  name: string;
  version: string;
  calculateRisk(
    packages: RiskInputPackage[],
    relationships: Array<{ source: string; target: string }>,
    threshold?: number
  ): ProjectRiskResult;
}
