export interface Project {
  id: string;
  name: string;
  repoUrl?: string;
  ecosystem: string;
  createdAt: string;
  updatedAt: string;
}

export interface GraphMetric {
  depth: number;
  inDegree: number;
  outDegree: number;
  directDependents: number;
  transitiveDependents: number;
  downstreamPathsCount: number;
  blastRadiusScore: number;
  centralityScore: number;
  reachabilityCount: number;
}

export interface Vulnerability {
  id: string;
  packageName: string;
  installedVersion: string;
  vulnId: string;
  cveId?: string;
  title?: string;
  summary?: string;
  details?: string;
  severity: number;
  severityRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedVersions?: string;
  fixedVersion?: string;
  epssScore?: number;
  epssPercentile?: number;
  finalRiskScore: number;
  references?: string;
  publishedDate?: string;
}

export interface PackageItem {
  id: string;
  name: string;
  version: string;
  ecosystem: string;
  isDirect: boolean;
  depth: number;
  packageRisk: number;
  propagatedRisk: number;
  graphMetric?: GraphMetric;
  vulnerabilities: Vulnerability[];
}

export interface RiskScoreDetails {
  overallScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' | 'CRITICAL';
  severityContrib: number;
  epssContrib: number;
  dependencyContrib: number;
  blastRadiusContrib: number;
  propagationContrib: number;
  fixFactorContrib: number;
}

export interface RemediationItem {
  id?: string;
  packageName: string;
  currentVersion: string;
  recommendedVersion: string;
  currentRiskScore: number;
  simulatedRiskScore: number;
  riskReductionPoints: number;
  riskReductionPercent: number;
  rationale: string[];
  prRecommendation: 'SAFE TO MERGE' | 'STILL BLOCKED';
}

export interface Analysis {
  id: string;
  projectId: string;
  project?: Project;
  status: string;
  branch?: string;
  commitSha?: string;
  prNumber?: number;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' | 'CRITICAL';
  gateStatus: 'PASSED' | 'BLOCKED';
  gateThreshold: number;
  totalDependencies: number;
  directDependencies: number;
  transitiveDependencies: number;
  vulnerableCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  maxBlastRadius: number;
  isDemo: boolean;
  createdAt: string;
  packages?: PackageItem[];
  vulnerabilities?: Vulnerability[];
  riskDetails?: RiskScoreDetails[];
  remediations?: RemediationItem[];
}

export interface FlowNodeData {
  label: string;
  name?: string;
  version?: string;
  ecosystem?: string;
  isDirect?: boolean;
  depth?: number;
  packageRisk?: number;
  propagatedRisk?: number;
  effectiveRisk?: number;
  vulnerabilitiesCount?: number;
  hasCritical?: boolean;
  hasHigh?: boolean;
  blastRadius?: number;
  directDependents?: number;
  transitiveDependents?: number;
  fixedVersion?: string | null;
  isRoot?: boolean;
  [key: string]: unknown;
}
