import { Router } from 'express';
import { AnalysisService } from '../services/analysis.service.js';

export const githubRouter = Router();
const analysisService = new AnalysisService();

// POST /api/github/gate-check - Evaluates dependency payload for CI/CD actions
githubRouter.post('/gate-check', async (req, res) => {
  try {
    const {
      projectName,
      repoUrl,
      filename,
      content,
      branch,
      commitSha,
      prNumber,
      threshold,
      isDemo,
    } = req.body;

    if (!content || !filename) {
      return res.status(400).json({ error: 'filename and content are required' });
    }

    const analysis = await analysisService.runAnalysis({
      projectName: projectName || 'github-pr-check',
      repoUrl,
      filename,
      content,
      branch: branch || 'feature/security-update',
      commitSha: commitSha || 'sha-pr-head',
      prNumber: prNumber ? parseInt(prNumber) : 42,
      threshold: threshold ? parseFloat(threshold) : undefined,
      isDemo: Boolean(isDemo),
    });

    res.json({
      canMerge: analysis.gateResult.canMerge,
      gateStatus: analysis.gateResult.status,
      overallRiskScore: analysis.overallRiskScore,
      riskLevel: analysis.riskLevel,
      threshold: analysis.gateResult.threshold,
      markdownComment: analysis.gateResult.markdownComment,
      analysisId: analysis.analysisId,
      topPriorityItem: analysis.gateResult.topPriorityItem,
      topSimulation: analysis.gateResult.topSimulation,
      summary: analysis.gateResult.summary,
    });
  } catch (err: any) {
    console.error('Gate check error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/github/webhook - Webhook integration for GitHub pull_request events
githubRouter.post('/webhook', async (req, res) => {
  try {
    const event = req.headers['x-github-event'] || 'pull_request';
    const payload = req.body;

    if (event === 'ping') {
      return res.json({ message: 'Pong! RippleGuard webhook active.' });
    }

    if (event === 'pull_request') {
      const action = payload.action;
      if (['opened', 'synchronize', 'reopened'].includes(action)) {
        console.log(`[GitHub Webhook] Received PR #${payload.number} (${action}) for ${payload.repository?.full_name}`);
        // In a live production setup, this would fetch the PR diff via GitHub API.
        // For the prototype, we acknowledge and return the status.
        return res.json({
          status: 'acknowledged',
          action,
          prNumber: payload.number,
          repository: payload.repository?.full_name,
        });
      }
    }

    res.json({ status: 'ignored', reason: 'Event or action not monitored' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
