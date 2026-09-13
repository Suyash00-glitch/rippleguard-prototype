import { Analysis, FlowNodeData } from '../types';

const API_BASE = '/api';

export const api = {
  async getAnalyses(): Promise<Analysis[]> {
    const res = await fetch(`${API_BASE}/analyses`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async getAnalysis(id: string): Promise<Analysis> {
    const res = await fetch(`${API_BASE}/analyses/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async getGraph(id: string): Promise<{
    nodes: Array<{ id: string; type: string; data: FlowNodeData }>;
    edges: Array<{ id: string; source: string; target: string; animated?: boolean }>;
  }> {
    const res = await fetch(`${API_BASE}/analyses/${id}/graph`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async runAnalysis(payload: {
    projectName?: string;
    repoUrl?: string;
    ecosystem: string;
    filename: string;
    content: string;
    branch?: string;
    commitSha?: string;
    prNumber?: number;
    threshold?: number;
    isDemo?: boolean;
  }): Promise<{ analysisId: string }> {
    const res = await fetch(`${API_BASE}/analyses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async loadCanonicalDemo(): Promise<{ analysisId: string }> {
    const res = await fetch(`${API_BASE}/demo/load-vulnerable-canonical`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed loading demo`);
    }
    return res.json();
  },

  async simulateRemediation(
    analysisId: string,
    packageName: string,
    targetVersion: string
  ) {
    const res = await fetch(`${API_BASE}/analyses/${analysisId}/simulate-remediation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageName, targetVersion }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async checkGate(payload: {
    projectName: string;
    filename: string;
    content: string;
    threshold: number;
    prNumber?: number;
  }) {
    const res = await fetch(`${API_BASE}/github/gate-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};
