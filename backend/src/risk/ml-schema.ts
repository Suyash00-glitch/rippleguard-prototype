import { RiskInputPackage, ProjectRiskResult, RiskModel } from './risk-model.interface.js';

/**
 * Feature vector schema for training an ML-based Supply Chain Risk Model.
 * This can be used with XGBoost, LightGBM, or a Graph Neural Network (GNN).
 */
export interface MLTrainingSample {
  id: string;
  package_name: string;
  ecosystem: 'npm' | 'pypi' | 'maven' | 'golang';

  // Vulnerability Features
  cvss_base_score: number;       // 0.0 - 10.0
  epss_score: number;            // 0.0 - 1.0 (exploit prediction scoring system)
  epss_percentile: number;       // 0.0 - 1.0
  vulnerability_count: number;
  has_known_exploit: boolean;    // CISA KEV or ExploitDB presence
  days_since_published: number;

  // Graph Topological Features
  dependency_depth: number;       // Hop distance from root
  is_direct_dependency: boolean;
  in_degree: number;              // Dependent count (consumers)
  out_degree: number;             // Dependency count (suppliers)
  transitive_dependents_count: number;
  downstream_paths_count: number;
  centrality_betweenness: number; // 0.0 - 1.0
  blast_radius_ratio: number;     // 0.0 - 1.0

  // Remediation / Maintenance Features
  is_fix_available: boolean;
  patch_version_distance: number; // e.g. semver minor/patch distance
  package_weekly_downloads: number;
  repository_stars: number;

  // Ground Truth / Target Labels
  // Target: Historical incident occurrence (0 = safe, 1 = exploited or breached)
  // Or empirical incident response hours (continuous risk target 0-100)
  target_compromise_observed: number; // 0 or 1
  target_risk_score: number;          // 0.0 - 100.0
}

/**
 * Interface for future ML-based Risk Model.
 * Demonstrates how a trained model (e.g. ONNX runtime or TensorFlow.js)
 * can drop in seamlessly into the RippleGuard pipeline.
 */
export class MLRiskModel implements RiskModel {
  name = 'MLContextualRiskModel-GNN';
  version = '2.0.0-experimental';
  private modelWeightsUrl?: string;

  constructor(modelWeightsUrl?: string) {
    this.modelWeightsUrl = modelWeightsUrl;
  }

  /**
   * Transforms raw graph and vulnerability data into normalized feature vectors
   */
  extractFeatures(packages: RiskInputPackage[]): Float32Array[] {
    return packages.map(p => {
      const maxCvss = Math.max(...p.vulnerabilities.map(v => v.vuln.severity || 0), 0);
      const maxEpss = Math.max(...p.vulnerabilities.map(v => v.epss?.epss || 0), 0);
      const isFix = p.vulnerabilities.some(v => !!v.vuln.fixedVersion) ? 1.0 : 0.0;

      return new Float32Array([
        maxCvss / 10.0,
        maxEpss,
        p.depth,
        p.isDirect ? 1.0 : 0.0,
        p.metrics.inDegree,
        p.metrics.transitiveDependents.length,
        p.metrics.centralityScore,
        p.metrics.blastRadiusScore / 100.0,
        isFix,
      ]);
    });
  }

  calculateRisk(
    packages: RiskInputPackage[],
    relationships: Array<{ source: string; target: string }>,
    threshold = 70.0
  ): ProjectRiskResult {
    // Placeholder fallback delegating or returning ML inference envelope
    throw new Error(
      'MLRiskModel is an architectural placeholder. Use RuleBasedRiskModel for the MVP, or provide a trained ONNX artifact to enable ML inference.'
    );
  }
}
