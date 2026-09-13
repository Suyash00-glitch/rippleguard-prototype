import React from 'react';
import { Analysis } from '../types';
import { RiskGauge } from '../components/RiskGauge';
import { RiskBreakdownChart } from '../components/RiskBreakdownChart';
import { VulnerabilityTable } from '../components/VulnerabilityTable';
import { ShieldAlert, ShieldCheck, ArrowRight, Sparkles, Package } from 'lucide-react';

interface OverviewPageProps {
  analysis: Analysis | null;
  onNavigateTab: (tab: string) => void;
  onRemediate: (packageName: string, targetVersion: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  analysis,
  onNavigateTab,
  onRemediate,
}) => {
  if (!analysis) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 max-w-lg mx-auto my-8 space-y-3 shadow-sm">
        <Package className="h-10 w-10 text-slate-400 mx-auto" />
        <h3 className="text-lg font-bold text-slate-900">No Project Loaded</h3>
        <p className="text-xs text-slate-500">
          Click <strong>&quot;Reset Demo&quot;</strong> in the top bar to inspect a sample project with security issues.
        </p>
      </div>
    );
  }

  const isBlocked = analysis.gateStatus === 'BLOCKED';
  const riskDetails = analysis.riskDetails?.[0];
  const topRemediation = analysis.remediations?.[0];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Status Card */}
      <div
        className={`rounded-2xl p-6 sm:p-8 border shadow-sm ${
          isBlocked
            ? 'bg-rose-50/60 border-rose-200 text-rose-950'
            : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  isBlocked
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                {isBlocked ? (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5 mr-1 text-rose-600" />
                    Merge Blocked
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                    Safe to Merge
                  </>
                )}
              </span>
              <span className="text-xs text-slate-500">PR #{analysis.prNumber || 104}</span>
            </div>

            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isBlocked ? 'Security check failed. Merging is blocked.' : 'All security checks passed! Ready to merge.'}
            </h1>

            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              {isBlocked ? (
                <>
                  Found <strong className="text-slate-900">{analysis.vulnerableCount} security issue</strong> in dependencies.
                  {topRemediation && (
                    <>
                      {' '}Updating <strong className="text-slate-900 font-mono">{topRemediation.packageName}</strong> to{' '}
                      <strong className="text-emerald-700 font-mono font-bold">v{topRemediation.recommendedVersion}</strong> will fix it and unblock your PR.
                    </>
                  )}
                </>
              ) : (
                'All dependencies have acceptable risk scores and no blocking security flaws were found.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-col gap-2.5 shrink-0">
            {isBlocked && (
              <button
                onClick={() => onNavigateTab('remediation')}
                className="flex items-center justify-center space-x-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                <span>Open Fix Simulator</span>
              </button>
            )}
            <button
              onClick={() => onNavigateTab('graph')}
              className="flex items-center justify-center space-x-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 px-5 py-2.5 text-xs font-semibold text-slate-700 transition-all cursor-pointer shadow-sm"
            >
              <span>View Map</span>
              <ArrowRight className="h-4 w-4 text-slate-500" />
            </button>
          </div>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Danger Score
          </span>
          <div className="flex items-baseline space-x-1.5">
            <span
              className={`text-3xl font-extrabold font-mono ${
                isBlocked ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {Math.round(analysis.riskScore)}
            </span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <p className="text-xs text-slate-500">
            {isBlocked
              ? 'Above the 70 safety threshold limit.'
              : 'Within the safe allowable threshold.'}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Libraries Analyzed
          </span>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-3xl font-extrabold font-mono text-slate-900">
              {analysis.totalDependencies}
            </span>
            <span className="text-xs text-slate-500">packages</span>
          </div>
          <p className="text-xs text-slate-500">
            {analysis.directDependencies} direct • {analysis.transitiveDependencies} nested dependencies
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Recommended Upgrade
          </span>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-3xl font-extrabold font-mono text-emerald-600">
              {topRemediation ? `-${topRemediation.riskReductionPercent}%` : 'Clean'}
            </span>
            <span className="text-xs text-slate-500">{topRemediation ? 'Risk Drop' : 'No Action'}</span>
          </div>
          <p className="text-xs text-slate-500 truncate">
            {topRemediation
              ? `Upgrade ${topRemediation.packageName} to v${topRemediation.recommendedVersion}`
              : 'All libraries are up to date'}
          </p>
        </div>
      </div>

      {/* Visualizations Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5">
          <RiskGauge
            score={analysis.riskScore}
            threshold={analysis.gateThreshold}
            level={analysis.riskLevel}
          />
        </div>
        <div className="lg:col-span-7">
          <RiskBreakdownChart details={riskDetails} />
        </div>
      </div>

      {/* Security Issues Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Security Issues ({analysis.vulnerabilities?.length || 0})
            </h2>
            <p className="text-xs text-slate-500">
              Prioritized by severity and attack probability
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('vulnerabilities')}
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-1"
          >
            <span>View All</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <VulnerabilityTable
          vulnerabilities={analysis.vulnerabilities || []}
          packages={analysis.packages || []}
          onRemediate={onRemediate}
        />
      </div>
    </div>
  );
};
