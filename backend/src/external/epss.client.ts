import { DEMO_VULNERABILITIES } from './mock-data.js';

export interface EpssResult {
  cve: string;
  epss: number;       // 0.0 to 1.0 (e.g., 0.87)
  percentile: number; // 0.0 to 1.0 (e.g., 0.96)
  date?: string;
  isFallback: boolean;
}

export class EpssClient {
  private baseUrl: string;
  private cache: Map<string, EpssResult> = new Map();

  constructor(baseUrl = process.env.EPSS_API_URL || 'https://api.first.org/data/v1/epss') {
    this.baseUrl = baseUrl;
  }

  async getScore(cve: string | null, isDemo = false): Promise<EpssResult> {
    if (!cve || !cve.startsWith('CVE-')) {
      return {
        cve: cve || 'N/A',
        epss: 0.05, // baseline minimal probability
        percentile: 0.1,
        isFallback: true,
      };
    }

    if (this.cache.has(cve)) {
      return this.cache.get(cve)!;
    }

    // Check demo data for deterministic score
    if (isDemo || cve === 'CVE-2024-8891' || cve === 'CVE-XXXX') {
      for (const eco of Object.values(DEMO_VULNERABILITIES)) {
        for (const pkgs of Object.values(eco)) {
          const matched = pkgs.find(p => p.cveId === cve);
          if (matched) {
            const demoResult: EpssResult = {
              cve: matched.cveId,
              epss: matched.epss,
              percentile: matched.percentile,
              date: '2024-06-16',
              isFallback: false,
            };
            this.cache.set(cve, demoResult);
            return demoResult;
          }
        }
      }
    }

    try {
      const url = `${this.baseUrl}?cve=${encodeURIComponent(cve)}`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`EPSS API HTTP ${response.status}`);
      }

      const data: any = await response.json();
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        const item = data.data[0];
        const result: EpssResult = {
          cve: item.cve,
          epss: parseFloat(item.epss) || 0.05,
          percentile: parseFloat(item.percentile) || 0.1,
          date: item.date,
          isFallback: false,
        };
        this.cache.set(cve, result);
        return result;
      }

      // Not found in EPSS database
      const fallback: EpssResult = {
        cve,
        epss: 0.05,
        percentile: 0.15,
        isFallback: true,
      };
      this.cache.set(cve, fallback);
      return fallback;
    } catch (err: any) {
      console.warn(`[EPSS Warning] Failed fetching score for ${cve}: ${err.message}. Using documented baseline.`);
      const fallback: EpssResult = {
        cve,
        epss: 0.05,
        percentile: 0.15,
        isFallback: true,
      };
      this.cache.set(cve, fallback);
      return fallback;
    }
  }
}
