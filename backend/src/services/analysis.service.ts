import { prisma } from '../db/client.js';
import { ParserFactory, Ecosystem } from '../parsers/index.js';
import { DependencyGraph } from '../graph/dependency-graph.js';
import { OsvClient } from '../external/osv.client.js';
import { EpssClient } from '../external/epss.client.js';
import { RuleBasedRiskModel } from '../risk/rule-based.model.js';
import { PrioritizationEngine, PrioritizedItem } from '../risk/prioritization.engine.js';
import { RemediationSimulator, SimulationResult } from '../risk/remediation.simulator.js';
import { GitHubGateService, GateCheckResult } from './github-gate.service.js';
import { RiskInputPackage } from '../risk/risk-model.interface.js';

export interface RunAnalysisOptions {
  projectId?: string;
  projectName?: string;
  repoUrl?: string;
  ecosystem?: Ecosystem;
  content: string;
  filename: string;
  branch?: string;
  commitSha?: string;
  prNumber?: number;
  threshold?: number;
  isDemo?: boolean;
}

export class AnalysisService {
  private osvClient = new OsvClient();
  private epssClient = new EpssClient();
  private riskModel = new RuleBasedRiskModel();

  async runAnalysis(opts: RunAnalysisOptions) {
    const threshold = opts.threshold || parseFloat(process.env.RIPPLEGUARD_RISK_THRESHOLD || '70.0');
    const isDemo = opts.isDemo || false;

    // 1. Parse dependencies
    const parseResult = ParserFactory.parse(opts.filename, opts.content);
    const projectName = opts.projectName || parseResult.projectName || 'analyzed-project';
    const ecosystem = opts.ecosystem || parseResult.ecosystem || 'npm';

    // 2. Find or create Project
    let project = opts.projectId
      ? await prisma.project.findUnique({ where: { id: opts.projectId } })
      : null;

    if (!project) {
      project = await prisma.project.create({
        data: {
          name: projectName,
          repoUrl: opts.repoUrl || '',
          ecosystem: ecosystem,
        },
      });
    }

    // 3. Build Dependency Graph
    const graph = new DependencyGraph(projectName);

    // Add nodes
    for (const pkg of parseResult.packages) {
      graph.addNode({
        id: pkg.name,
        name: pkg.name,
        version: pkg.version,
        ecosystem: pkg.ecosystem,
        isDirect: pkg.direct_dependency,
        depth: pkg.depth || (pkg.direct_dependency ? 1 : 2),
      });
    }

    // Add edges with normalized root
    const rawRels = parseResult.rawRelationships || [];
    const relationships = rawRels.map(rel => ({
      source: (rel.source === parseResult.projectName || rel.source === 'unnamed-project') ? projectName : rel.source,
      target: rel.target,
    }));

    for (const rel of relationships) {
      graph.addEdge(rel.source, rel.target);
    }

    // Calculate Graph Metrics
    const metricsMap = graph.calculateAllMetrics();

    // 4. Query OSV and EPSS for all packages
    const packageVulnerabilities = new Map<string, Array<{ vuln: any; epss: any }>>();

    for (const pkg of parseResult.packages) {
      const vulns = await this.osvClient.queryPackage(pkg.name, pkg.version, pkg.ecosystem, isDemo);
      const enrichedVulns: Array<{ vuln: any; epss: any }> = [];

      for (const v of vulns) {
        const epss = await this.epssClient.getScore(v.cveId, isDemo);
        enrichedVulns.push({ vuln: v, epss });
      }

      packageVulnerabilities.set(pkg.name, enrichedVulns);
    }

    // 5. Prepare RiskInputPackages
    const riskInputPackages: RiskInputPackage[] = parseResult.packages.map(pkg => {
      const m = metricsMap.get(pkg.name) || {
        depth: pkg.direct_dependency ? 1 : 2,
        inDegree: 0,
        outDegree: 0,
        directDependents: [],
        transitiveDependents: [],
        dependencies: [],
        transitiveDependencies: [],
        downstreamPathsCount: 1,
        blastRadiusScore: 0,
        centralityScore: 0,
        reachableNodesCount: 0,
      };

      return {
        name: pkg.name,
        version: pkg.version,
        ecosystem: pkg.ecosystem,
        isDirect: pkg.direct_dependency,
        depth: m.depth,
        metrics: m,
        vulnerabilities: packageVulnerabilities.get(pkg.name) || [],
      };
    });

    // 6. Calculate Risk
    const riskResult = this.riskModel.calculateRisk(riskInputPackages, relationships, threshold);

    // 7. Prioritize Vulnerabilities
    const prioritizedItems = PrioritizationEngine.prioritize(riskInputPackages, riskResult.packageRisks);

    // 8. Run Remediation Simulations for packages with available fixes
    const simulations: SimulationResult[] = [];
    const simulatedPackages = new Set<string>();

    for (const item of prioritizedItems) {
      if (item.fixedVersion && !simulatedPackages.has(item.packageName)) {
        simulatedPackages.add(item.packageName);
        const sim = RemediationSimulator.simulatePatch(
          item.packageName,
          item.fixedVersion,
          riskInputPackages,
          relationships,
          riskResult.overallRiskScore,
          threshold
        );
        simulations.push(sim);
      }
    }

    // 9. GitHub Gate Evaluation
    const gateResult = GitHubGateService.evaluateGate(
      riskResult,
      prioritizedItems,
      simulations,
      parseResult.packages.length
    );

    // 10. Persist to SQLite via Prisma
    const directCount = parseResult.packages.filter(p => p.direct_dependency).length;
    const transitiveCount = parseResult.packages.length - directCount;

    const maxBlast = Math.max(0, ...Array.from(metricsMap.values()).map(m => m.blastRadiusScore));

    const analysis = await prisma.analysis.create({
      data: {
        projectId: project.id,
        status: 'COMPLETED',
        branch: opts.branch || 'main',
        commitSha: opts.commitSha || 'latest',
        prNumber: opts.prNumber || null,
        riskScore: riskResult.overallRiskScore,
        riskLevel: riskResult.riskLevel,
        gateStatus: gateResult.status,
        gateThreshold: threshold,
        totalDependencies: parseResult.packages.length,
        directDependencies: directCount,
        transitiveDependencies: transitiveCount,
        vulnerableCount: prioritizedItems.length,
        criticalCount: gateResult.summary.criticalCount,
        highCount: gateResult.summary.highCount,
        mediumCount: gateResult.summary.mediumCount,
        lowCount: gateResult.summary.lowCount,
        maxBlastRadius: maxBlast,
        isDemo,
      },
    });

    // Save Packages & Metrics
    for (const pkg of riskInputPackages) {
      const riskCalc = riskResult.packageRisks.get(pkg.name);
      const pkgRecord = await prisma.package.create({
        data: {
          analysisId: analysis.id,
          name: pkg.name,
          version: pkg.version,
          ecosystem: pkg.ecosystem,
          isDirect: pkg.isDirect,
          depth: pkg.depth,
          packageRisk: riskCalc?.baseVulnerabilityRisk || 0,
          propagatedRisk: riskCalc?.propagatedRisk || 0,
        },
      });

      // Save GraphMetric
      await prisma.graphMetric.create({
        data: {
          analysisId: analysis.id,
          packageId: pkgRecord.id,
          packageName: pkg.name,
          depth: pkg.metrics.depth,
          inDegree: pkg.metrics.inDegree,
          outDegree: pkg.metrics.outDegree,
          directDependents: pkg.metrics.directDependents.length,
          transitiveDependents: pkg.metrics.transitiveDependents.length,
          downstreamPathsCount: pkg.metrics.downstreamPathsCount,
          blastRadiusScore: pkg.metrics.blastRadiusScore,
          centralityScore: pkg.metrics.centralityScore,
          reachabilityCount: pkg.metrics.reachableNodesCount,
        },
      });

      // Save Vulnerabilities
      for (const vItem of pkg.vulnerabilities) {
        const vuln = vItem.vuln;
        const epss = vItem.epss;

        const createdVuln = await prisma.vulnerability.create({
          data: {
            analysisId: analysis.id,
            packageId: pkgRecord.id,
            packageName: pkg.name,
            installedVersion: pkg.version,
            vulnId: vuln.vulnId,
            cveId: vuln.cveId,
            title: vuln.title,
            summary: vuln.summary,
            details: vuln.details,
            severity: vuln.severity,
            severityRating: vuln.severityRating,
            affectedVersions: vuln.affectedVersions,
            fixedVersion: vuln.fixedVersion,
            references: JSON.stringify(vuln.references || []),
            publishedDate: vuln.publishedDate,
            modifiedDate: vuln.modifiedDate,
            epssScore: epss.epss,
            epssPercentile: epss.percentile,
            finalRiskScore: riskCalc?.finalRiskScore || 0,
          },
        });

        if (epss.cve && epss.cve.startsWith('CVE-')) {
          await prisma.ePSSData.create({
            data: {
              vulnerabilityId: createdVuln.id,
              cve: epss.cve,
              epss: epss.epss,
              percentile: epss.percentile,
              date: epss.date || '',
            },
          });
        }
      }
    }

    // Save Relationships
    for (const rel of relationships) {
      await prisma.dependencyRelationship.create({
        data: {
          analysisId: analysis.id,
          sourceName: rel.source,
          targetName: rel.target,
        },
      });
    }

    // Save Project Risk Score breakdown
    await prisma.riskScore.create({
      data: {
        analysisId: analysis.id,
        overallScore: riskResult.overallRiskScore,
        riskLevel: riskResult.riskLevel,
        severityContrib: riskResult.aggregatedContributions.severityContribution,
        epssContrib: riskResult.aggregatedContributions.epssContribution,
        dependencyContrib: riskResult.aggregatedContributions.dependencyImpactContribution,
        blastRadiusContrib: riskResult.aggregatedContributions.blastRadiusContribution,
        propagationContrib: riskResult.aggregatedContributions.propagationContribution,
        fixFactorContrib: riskResult.aggregatedContributions.fixFactorContribution,
      },
    });

    // Save Remediation Simulations
    for (const sim of simulations) {
      await prisma.remediationSimulation.create({
        data: {
          analysisId: analysis.id,
          packageName: sim.packageName,
          currentVersion: sim.currentVersion,
          recommendedVersion: sim.recommendedVersion,
          currentRiskScore: sim.currentRiskScore,
          simulatedRiskScore: sim.simulatedRiskScore,
          riskReductionPoints: sim.riskReductionPoints,
          riskReductionPercent: sim.riskReductionPercent,
          rationale: JSON.stringify(sim.rationale),
          prRecommendation: sim.prRecommendation,
        },
      });
    }

    return {
      analysisId: analysis.id,
      projectId: project.id,
      projectName: project.name,
      overallRiskScore: riskResult.overallRiskScore,
      riskLevel: riskResult.riskLevel,
      gateResult,
      prioritizedItems,
      simulations,
      totalDependencies: parseResult.packages.length,
      directDependencies: directCount,
      transitiveDependencies: transitiveCount,
      isDemo,
    };
  }

  async getAnalysisById(id: string) {
    const analysis = await prisma.analysis.findUnique({
      where: { id },
      include: {
        project: true,
        packages: {
          include: {
            vulnerabilities: { include: { epssData: true } },
            graphMetric: true,
          },
        },
        relationships: true,
        riskDetails: true,
        remediations: true,
      },
    });

    if (!analysis) return null;

    return {
      ...analysis,
      remediations: analysis.remediations.map(r => {
        let parsedRationale: string[] = [];
        try {
          parsedRationale = typeof r.rationale === 'string' ? JSON.parse(r.rationale) : (r.rationale || []);
        } catch {
          parsedRationale = [r.rationale];
        }
        return {
          ...r,
          rationale: parsedRationale,
        };
      }),
    };
  }

  async listAnalyses() {
    return prisma.analysis.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        project: true,
      },
    });
  }

  async getGraph(analysisId: string) {
    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
      include: {
        project: true,
        packages: {
          include: {
            vulnerabilities: true,
            graphMetric: true,
          },
        },
        relationships: true,
      },
    });

    if (!analysis) return null;

    // Format for React Flow visualization
    const nodes = [
      {
        id: analysis.project?.name || 'Application',
        type: 'root',
        data: {
          label: analysis.project?.name || 'Application',
          isRoot: true,
          risk: 0,
          depth: 0,
        },
      },
      ...analysis.packages.map(p => {
        const hasCritical = p.vulnerabilities.some(v => v.severityRating === 'CRITICAL');
        const hasHigh = p.vulnerabilities.some(v => v.severityRating === 'HIGH');
        return {
          id: p.name,
          type: 'dependency',
          data: {
            label: p.name,
            name: p.name,
            version: p.version,
            ecosystem: p.ecosystem,
            isDirect: p.isDirect,
            depth: p.depth,
            packageRisk: p.packageRisk,
            propagatedRisk: p.propagatedRisk,
            effectiveRisk: Math.max(p.packageRisk, p.propagatedRisk),
            vulnerabilitiesCount: p.vulnerabilities.length,
            hasCritical,
            hasHigh,
            blastRadius: p.graphMetric?.blastRadiusScore || 0,
            directDependents: p.graphMetric?.directDependents || 0,
            transitiveDependents: p.graphMetric?.transitiveDependents || 0,
            fixedVersion: p.vulnerabilities[0]?.fixedVersion || null,
          },
        };
      }),
    ];

    const edges = analysis.relationships.map((r, i) => ({
      id: `e-${r.sourceName}-${r.targetName}-${i}`,
      source: r.sourceName,
      target: r.targetName,
      animated: true,
    }));

    return { nodes, edges };
  }
}
