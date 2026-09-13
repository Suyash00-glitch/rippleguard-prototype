import { Router } from 'express';
import { AnalysisService } from '../services/analysis.service.js';
import { prisma } from '../db/client.js';
import { RemediationSimulator } from '../risk/remediation.simulator.js';
import { PrioritizationEngine } from '../risk/prioritization.engine.js';
import { RuleBasedRiskModel } from '../risk/rule-based.model.js';

export const analysesRouter = Router();
const analysisService = new AnalysisService();

// POST /api/analyses - Trigger analysis
analysesRouter.post('/', async (req, res) => {
  try {
    const {
      projectId,
      projectName,
      repoUrl,
      ecosystem,
      content,
      filename,
      branch,
      commitSha,
      prNumber,
      threshold,
      isDemo,
    } = req.body;

    if (!content || !filename) {
      return res.status(400).json({ error: 'content and filename are required' });
    }

    const result = await analysisService.runAnalysis({
      projectId,
      projectName,
      repoUrl,
      ecosystem,
      content,
      filename,
      branch,
      commitSha,
      prNumber,
      threshold: threshold ? parseFloat(threshold) : undefined,
      isDemo: Boolean(isDemo),
    });

    res.status(201).json(result);
  } catch (err: any) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analyses - List recent analyses
analysesRouter.get('/', async (req, res) => {
  try {
    const list = await analysisService.listAnalyses();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analyses/:id - Detailed analysis
analysesRouter.get('/:id', async (req, res) => {
  try {
    const analysis = await analysisService.getAnalysisById(req.params.id);
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    res.json(analysis);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analyses/:id/dependencies - List packages & metrics
analysesRouter.get('/:id/dependencies', async (req, res) => {
  try {
    const packages = await prisma.package.findMany({
      where: { analysisId: req.params.id },
      include: {
        graphMetric: true,
        vulnerabilities: true,
      },
    });
    res.json(packages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analyses/:id/graph - Nodes and edges for React Flow
analysesRouter.get('/:id/graph', async (req, res) => {
  try {
    const graphData = await analysisService.getGraph(req.params.id);
    if (!graphData) {
      return res.status(404).json({ error: 'Graph not found' });
    }
    res.json(graphData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analyses/:id/vulnerabilities - List of vulnerabilities with prioritization
analysesRouter.get('/:id/vulnerabilities', async (req, res) => {
  try {
    const vulns = await prisma.vulnerability.findMany({
      where: { analysisId: req.params.id },
      include: {
        epssData: true,
        package: {
          include: { graphMetric: true },
        },
      },
      orderBy: { finalRiskScore: 'desc' },
    });
    res.json(vulns);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analyses/:id/risk - Risk score and contribution breakdown
analysesRouter.get('/:id/risk', async (req, res) => {
  try {
    const risk = await prisma.riskScore.findFirst({
      where: { analysisId: req.params.id },
    });
    const analysis = await prisma.analysis.findUnique({
      where: { id: req.params.id },
      select: {
        riskScore: true,
        riskLevel: true,
        gateStatus: true,
        gateThreshold: true,
      },
    });

    res.json({
      overallRiskScore: analysis?.riskScore || 0,
      riskLevel: analysis?.riskLevel || 'LOW',
      gateStatus: analysis?.gateStatus || 'PASSED',
      gateThreshold: analysis?.gateThreshold || 70,
      breakdown: risk || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analyses/:id/remediations - List saved remediation simulations
analysesRouter.get('/:id/remediations', async (req, res) => {
  try {
    const rems = await prisma.remediationSimulation.findMany({
      where: { analysisId: req.params.id },
      orderBy: { riskReductionPoints: 'desc' },
    });
    res.json(rems.map(r => ({
      ...r,
      rationale: JSON.parse(r.rationale || '[]'),
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/analyses/:id/simulate-remediation - Custom what-if patch simulation
analysesRouter.post('/:id/simulate-remediation', async (req, res) => {
  try {
    const { packageName, targetVersion } = req.body;
    if (!packageName || !targetVersion) {
      return res.status(400).json({ error: 'packageName and targetVersion are required' });
    }

    const analysis = await analysisService.getAnalysisById(req.params.id);
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    // Reconstruct packages structure
    const packages = analysis.packages.map(p => ({
      name: p.name,
      version: p.version,
      ecosystem: p.ecosystem,
      isDirect: p.isDirect,
      depth: p.depth,
      metrics: {
        depth: p.graphMetric?.depth || p.depth,
        inDegree: p.graphMetric?.inDegree || 0,
        outDegree: p.graphMetric?.outDegree || 0,
        directDependents: [],
        transitiveDependents: [],
        dependencies: [],
        transitiveDependencies: [],
        downstreamPathsCount: p.graphMetric?.downstreamPathsCount || 1,
        blastRadiusScore: p.graphMetric?.blastRadiusScore || 0,
        centralityScore: p.graphMetric?.centralityScore || 0,
        reachableNodesCount: p.graphMetric?.reachabilityCount || 0,
      },
      vulnerabilities: p.vulnerabilities.map(v => ({
        vuln: {
          vulnId: v.vulnId,
          cveId: v.cveId,
          title: v.title || '',
          summary: v.summary || '',
          details: v.details || '',
          severity: v.severity,
          severityRating: v.severityRating as any,
          affectedVersions: v.affectedVersions || '',
          fixedVersion: v.fixedVersion,
          publishedDate: v.publishedDate,
          modifiedDate: v.modifiedDate,
          references: JSON.parse(v.references || '[]'),
        },
        epss: {
          cve: v.cveId || '',
          epss: v.epssScore || 0.05,
          percentile: v.epssPercentile || 0.1,
          isFallback: false,
        },
      })),
    }));

    const relationships = analysis.relationships.map(r => ({
      source: r.sourceName,
      target: r.targetName,
    }));

    const simulation = RemediationSimulator.simulatePatch(
      packageName,
      targetVersion,
      packages,
      relationships,
      analysis.riskScore,
      analysis.gateThreshold
    );

    res.json(simulation);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
