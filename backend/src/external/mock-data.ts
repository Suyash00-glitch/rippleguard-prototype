export interface MockVulnDefinition {
  vulnId: string;
  cveId: string;
  title: string;
  summary: string;
  severity: number; // CVSS 0 - 10
  severityRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedVersions: string;
  fixedVersion: string;
  publishedDate: string;
  epss: number;
  percentile: number;
}

export const DEMO_VULNERABILITIES: Record<string, Record<string, MockVulnDefinition[]>> = {
  // npm ecosystem
  npm: {
    'crypto-core-pkg-c': [
      {
        vulnId: 'GHSA-demo-c210',
        cveId: 'CVE-2024-8891',
        title: 'Remote Code Execution in Core Cryptographic Parser',
        summary: 'Improper bounds checking leading to unauthenticated memory corruption and RCE.',
        severity: 9.8,
        severityRating: 'CRITICAL',
        affectedVersions: '>=2.0.0 <2.4.0',
        fixedVersion: '2.4.0',
        publishedDate: '2024-06-15T00:00:00Z',
        epss: 0.87,
        percentile: 0.96,
      },
    ],
    'lodash': [
      {
        vulnId: 'GHSA-35jh-r3h4-6jhm',
        cveId: 'CVE-2019-10744',
        title: 'Prototype Pollution in lodash',
        summary: 'Versions of lodash before 4.17.19 are vulnerable to Prototype Pollution.',
        severity: 7.5,
        severityRating: 'HIGH',
        affectedVersions: '<4.17.19',
        fixedVersion: '4.17.19',
        publishedDate: '2019-07-15T00:00:00Z',
        epss: 0.78,
        percentile: 0.92,
      },
    ],
    'axios': [
      {
        vulnId: 'GHSA-42xw-2xvc-rh8d',
        cveId: 'CVE-2020-28168',
        title: 'Server-Side Request Forgery in axios',
        summary: 'Axios up to 0.21.0 allows SSRF via custom headers.',
        severity: 6.5,
        severityRating: 'MEDIUM',
        affectedVersions: '<0.21.1',
        fixedVersion: '0.21.1',
        publishedDate: '2020-11-13T00:00:00Z',
        epss: 0.35,
        percentile: 0.65,
      },
    ],
  },
  // pypi ecosystem
  pypi: {
    'flask': [
      {
        vulnId: 'GHSA-demo-flsk',
        cveId: 'CVE-2021-28957',
        title: 'Information Disclosure in Flask Sessions',
        summary: 'Improper cookie signature verification in legacy Flask releases.',
        severity: 7.2,
        severityRating: 'HIGH',
        affectedVersions: '<2.0.0',
        fixedVersion: '2.0.0',
        publishedDate: '2021-03-20T00:00:00Z',
        epss: 0.62,
        percentile: 0.88,
      },
    ],
    'jinja2': [
      {
        vulnId: 'GHSA-demo-jnja',
        cveId: 'CVE-2020-28493',
        title: 'Regular Expression Denial of Service in Jinja2',
        summary: 'Catastrophic backtracking in email address parsing regex.',
        severity: 5.3,
        severityRating: 'MEDIUM',
        affectedVersions: '<2.11.3',
        fixedVersion: '2.11.3',
        publishedDate: '2021-02-01T00:00:00Z',
        epss: 0.21,
        percentile: 0.49,
      },
    ],
  },
};
