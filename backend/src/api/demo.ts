import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { AnalysisService } from '../services/analysis.service.js';

export const demoRouter = Router();
const analysisService = new AnalysisService();

demoRouter.post('/load-vulnerable-canonical', async (req, res) => {
  try {
    const possiblePaths = [
      path.resolve(process.cwd(), 'examples/vulnerable-project/package-lock.json'),
      path.resolve(process.cwd(), '../examples/vulnerable-project/package-lock.json'),
    ];
    let content = '';

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        content = fs.readFileSync(p, 'utf-8');
        break;
      }
    }

    if (!content) {
      // Fallback in-memory content if path varies
      content = JSON.stringify({
        name: 'sample-vulnerable-app',
        version: '1.0.0',
        lockfileVersion: 3,
        packages: {
          '': {
            name: 'sample-vulnerable-app',
            version: '1.0.0',
            dependencies: {
              'auth-service-pkg-a': '1.0.0',
              'billing-service-pkg-b': '1.2.0',
              'logger-util-pkg-d': '2.0.1',
            },
          },
          'node_modules/auth-service-pkg-a': {
            version: '1.0.0',
            dependencies: { 'crypto-core-pkg-c': '2.1.0' },
          },
          'node_modules/billing-service-pkg-b': {
            version: '1.2.0',
            dependencies: { 'crypto-core-pkg-c': '2.1.0' },
          },
          'node_modules/crypto-core-pkg-c': {
            version: '2.1.0',
          },
          'node_modules/logger-util-pkg-d': {
            version: '2.0.1',
            dependencies: { 'formatting-helper-pkg-e': '1.0.0' },
          },
          'node_modules/formatting-helper-pkg-e': {
            version: '1.0.0',
          },
        },
      });
    }

    const result = await analysisService.runAnalysis({
      projectName: 'Demo Vulnerable Application (DAG: App → A,B → C)',
      repoUrl: 'https://github.com/rippleguard-demo/vulnerable-app',
      ecosystem: 'npm',
      filename: 'package-lock.json',
      content,
      branch: 'feature/crypto-upgrade-pr',
      prNumber: 104,
      threshold: 70.0,
      isDemo: true,
    });

    res.status(201).json(result);
  } catch (err: any) {
    console.error('Failed running demo:', err);
    res.status(500).json({ error: err.message });
  }
});
