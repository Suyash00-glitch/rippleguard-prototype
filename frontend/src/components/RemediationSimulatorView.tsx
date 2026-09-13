import React, { useState, useEffect } from 'react';
import { RemediationItem } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { ArrowRight, CheckCircle2, ShieldCheck, ShieldAlert, Sparkles, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface RemediationSimulatorViewProps {
  analysisId: string;
  remediations: RemediationItem[];
  currentRiskScore: number;
  threshold: number;
  onApplyFix?: (newAnalysisId: string) => void;
  onRunDemo?: () => void;
}

export const RemediationSimulatorView: React.FC<RemediationSimulatorViewProps> = ({
  analysisId,
  remediations,
  currentRiskScore,
  threshold,
  onApplyFix,
  onRunDemo,
}) => {
  const [selectedRemediation, setSelectedRemediation] = useState<RemediationItem | null>(null);
  const [testVersion, setTestVersion] = useState('2.4.0');
  const [activeTestedVersion, setActiveTestedVersion] = useState('2.4.0');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [customResult, setCustomResult] = useState<RemediationItem | null>(null);

  // Sync selected remediation on load
  useEffect(() => {
    if (remediations && remediations.length > 0) {
      if (!selectedRemediation || !remediations.some(r => r.packageName === selectedRemediation.packageName)) {
        const first = remediations[0];
        setSelectedRemediation(first);
        const defaultVer = first.recommendedVersion || '2.4.0';
        setActiveTestedVersion(defaultVer);
        setTestVersion(defaultVer);
      }
    }
  }, [remediations]);

  const activeItem = customResult || selectedRemediation || (remediations.length > 0 ? remediations[0] : null);

  const getRationaleList = (item: RemediationItem | null): string[] => {
    if (!item || !item.rationale) return [];
    if (Array.isArray(item.rationale)) return item.rationale;
    if (typeof item.rationale === 'string') {
      try {
        const parsed = JSON.parse(item.rationale);
        return Array.isArray(parsed) ? parsed : [item.rationale];
      } catch {
        return [item.rationale];
      }
    }
    return [];
  };

  const rationaleList = getRationaleList(activeItem);

  // Run the test simulation for a specific version
  const handleTestVersion = async (versionToTest: string) => {
    if (!activeItem || !versionToTest.trim()) return;

    try {
      setIsSimulating(true);
      const target = versionToTest.trim();
      setActiveTestedVersion(target);
      setTestVersion(target);
      const res = await api.simulateRemediation(analysisId, activeItem.packageName, target);
      setCustomResult({
        ...res,
        rationale: getRationaleList(res),
      });
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  // Apply the patch to the active PR
  const handleApplyFix = async () => {
    if (!activeItem) return;
    try {
      setIsApplying(true);

      const targetVer = activeItem.recommendedVersion || '2.4.0';

      const patchedLockfile = JSON.stringify({
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
            dependencies: { [activeItem.packageName]: targetVer },
          },
          'node_modules/billing-service-pkg-b': {
            version: '1.2.0',
            dependencies: { [activeItem.packageName]: targetVer },
          },
          [`node_modules/${activeItem.packageName}`]: {
            version: targetVer,
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

      const res = await api.runAnalysis({
        projectName: 'Demo Vulnerable Application (DAG: App → A,B → C)',
        ecosystem: 'npm',
        filename: 'package-lock.json',
        content: patchedLockfile,
        branch: 'feature/crypto-upgrade-pr',
        commitSha: 'sha-fix-applied',
        threshold,
        isDemo: true,
      });

      if (onApplyFix && res && res.analysisId) {
        onApplyFix(res.analysisId);
      }
    } catch (err: any) {
      alert(`Failed to apply fix: ${err.message}`);
    } finally {
      setIsApplying(false);
    }
  };

  const chartData = activeItem
    ? [
        {
          name: 'Current (v' + activeItem.currentVersion + ')',
          risk: Math.round(activeItem.currentRiskScore),
          color: '#DC2626',
        },
        {
          name: 'Tested (v' + activeItem.recommendedVersion + ')',
          risk: Math.round(activeItem.simulatedRiskScore),
          color: activeItem.prRecommendation === 'SAFE TO MERGE' ? '#16A34A' : '#DC2626',
        },
      ]
    : [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Title */}
      <div className="bg-white rounded-2xl p-6 border border-[#E8E3D5] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Fix Simulator</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            What happens if you update this library?
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Test any version before modifying your code to see if your Pull Request will be unblocked.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <div className="bg-[#FAF7EE] px-4 py-2 rounded-xl border border-[#E8E3D5] text-right">
            <span className="text-xs text-slate-500 block">Safety Gate Threshold</span>
            <span className="text-lg font-bold text-slate-900 font-mono">{threshold} / 100</span>
          </div>
          {onRunDemo && (
            <button
              onClick={onRunDemo}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-xs"
              title="Reset data back to the canonical vulnerable app"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Reset Demo</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: List & Test Version Controls */}
        <div className="lg:col-span-4 space-y-5">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Detected Vulnerabilities
            </h2>

            {remediations.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center text-slate-500 text-xs border border-[#E8E3D5] space-y-2 shadow-xs">
                <CheckCircle2 className="h-7 w-7 text-emerald-600 mx-auto mb-1" />
                <p className="font-semibold text-slate-800">All dependencies are clean.</p>
                <p className="text-[11px] text-slate-500">No vulnerable libraries require upgrading.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {remediations.map((rem, i) => {
                  const isSelected = activeItem?.packageName === rem.packageName;
                  const isAlreadyClean = rem.currentVersion === rem.recommendedVersion;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedRemediation(rem);
                        setCustomResult(null);
                        setTestVersion(rem.recommendedVersion);
                        setActiveTestedVersion(rem.recommendedVersion);
                      }}
                      className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-500 text-blue-950 shadow-xs ring-1 ring-blue-400'
                          : 'bg-white hover:bg-slate-50 border-[#E8E3D5] text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{rem.packageName}</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {isAlreadyClean ? 'Clean' : `-${rem.riskReductionPercent}% Risk`}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center space-x-1.5 text-xs text-slate-500 font-mono">
                        <span>v{rem.currentVersion}</span>
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        <span className="text-emerald-700 font-semibold">
                          {isAlreadyClean ? `v${rem.currentVersion} (Clean)` : `v${rem.recommendedVersion}`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Interactive Version Tester Box */}
          <div className="bg-white rounded-2xl p-5 border border-[#E8E3D5] shadow-xs space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-900 flex items-center">
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                Test a Version
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Click a preset or enter a custom version to simulate its impact in real-time:
              </p>
            </div>

            {/* Quick-Pick Version Presets */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Quick Options:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleTestVersion('2.4.0')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    activeTestedVersion === '2.4.0'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-300'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  2.4.0 (Official Fix)
                </button>
                <button
                  type="button"
                  onClick={() => handleTestVersion('2.2.0')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    activeTestedVersion === '2.2.0'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm ring-2 ring-rose-300'
                      : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  2.2.0 (Still Flawed)
                </button>
                <button
                  type="button"
                  onClick={() => handleTestVersion('3.0.0')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    activeTestedVersion === '3.0.0'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-300'
                      : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  3.0.0 (Latest Major)
                </button>
              </div>
            </div>

            {/* Manual input form */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handleTestVersion(testVersion);
              }}
              className="space-y-2 pt-1 border-t border-slate-100"
            >
              <div>
                <label className="text-xs text-slate-600 block mb-1">Enter Custom Version:</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="e.g. 2.4.0"
                    value={testVersion}
                    onChange={e => setTestVersion(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono bg-white"
                  />
                  <button
                    type="submit"
                    disabled={isSimulating || !testVersion.trim()}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isSimulating ? 'Testing...' : 'Test'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Clear Comparison Card */}
        <div className="lg:col-span-8 space-y-5">
          {activeItem ? (
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E8E3D5] shadow-xs space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Testing Package
                  </span>
                  <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                    {activeItem.packageName}
                  </h2>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Current: <span className="text-slate-800 font-bold">v{activeItem.currentVersion}</span> → Tested:{' '}
                    <span className="text-blue-600 font-bold font-mono">v{activeItem.recommendedVersion}</span>
                  </p>
                </div>

                <div>
                  {activeItem.prRecommendation === 'SAFE TO MERGE' ? (
                    <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-xl text-emerald-800 shadow-xs">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div>
                        <p className="font-bold text-xs">UNBLOCKS MERGE</p>
                        <p className="text-[10px] text-emerald-700">Pull Request will pass check</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 bg-rose-50 border border-rose-200 px-3.5 py-2 rounded-xl text-rose-800 shadow-xs">
                      <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                      <div>
                        <p className="font-bold text-xs">STILL BLOCKED</p>
                        <p className="text-[10px] text-rose-700">Version does not fix the flaw</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 3 Metric Readouts */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-[#FAF7EE] p-4 rounded-xl border border-[#E8E3D5]">
                  <span className="text-xs text-slate-500 block">Current Danger</span>
                  <p className="text-2xl font-bold font-mono text-rose-600 mt-1">
                    {Math.round(activeItem.currentRiskScore)}
                  </p>
                  <span className="text-[10px] text-rose-700 font-medium">Blocked ❌</span>
                </div>

                <div className="bg-[#FAF7EE] p-4 rounded-xl border border-[#E8E3D5]">
                  <span className="text-xs text-slate-500 block">Tested Danger</span>
                  <p
                    className={`text-2xl font-bold font-mono mt-1 ${
                      activeItem.prRecommendation === 'SAFE TO MERGE' ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {Math.round(activeItem.simulatedRiskScore)}
                  </p>
                  <span
                    className={`text-[10px] font-medium ${
                      activeItem.prRecommendation === 'SAFE TO MERGE' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {activeItem.prRecommendation === 'SAFE TO MERGE' ? 'Allowed ✅' : 'Still Blocked ❌'}
                  </span>
                </div>

                <div className="bg-[#FAF7EE] p-4 rounded-xl border border-[#E8E3D5]">
                  <span className="text-xs text-slate-500 block">Risk Change</span>
                  <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                    {activeItem.riskReductionPercent > 0 ? `-${activeItem.riskReductionPercent}%` : '0%'}
                  </p>
                  <span className="text-[10px] text-slate-500">
                    {activeItem.riskReductionPoints > 0
                      ? `-${Math.round(activeItem.riskReductionPoints)} pts`
                      : '0 pts'}
                  </span>
                </div>
              </div>

              {/* Clean Bar Chart */}
              <div className="bg-[#FAF7EE]/60 p-5 rounded-xl border border-[#E8E3D5]">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-3">
                  Score Comparison (Lower is Better)
                </span>
                <div className="h-36 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                      <YAxis domain={[0, 100]} stroke="#94A3B8" fontSize={11} />
                      <Tooltip
                        cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="rounded-lg bg-white border border-slate-200 p-2 shadow-sm text-xs">
                                <p className="font-semibold text-slate-900">{payload[0].payload.name}</p>
                                <p className="text-slate-700 font-mono mt-0.5">Danger: {payload[0].value} / 100</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="risk" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, idx) => (
                          <Cell key={`bar-${idx}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Rationale Bullet Points */}
              <div className="space-y-2 pt-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Simulation Explanation:
                </h3>
                <div className="space-y-1.5">
                  {rationaleList.map((reason, idx) => {
                    const isPositive = activeItem.prRecommendation === 'SAFE TO MERGE';
                    return (
                      <div
                        key={idx}
                        className={`flex items-start space-x-2 text-xs p-3 rounded-lg border ${
                          isPositive
                            ? 'text-slate-700 bg-[#FAF7EE] border-[#E8E3D5]'
                            : 'text-rose-900 bg-rose-50/60 border-rose-200'
                        }`}
                      >
                        {isPositive ? (
                          <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <span className="leading-relaxed">{reason}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Apply Upgrade CTA */}
              {activeItem.prRecommendation === 'SAFE TO MERGE' && (
                <div className="pt-3 border-t border-slate-100">
                  <button
                    onClick={handleApplyFix}
                    disabled={isApplying}
                    className="w-full flex items-center justify-center space-x-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 p-3.5 text-xs font-bold text-white shadow-sm transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                  >
                    <span>
                      {isApplying
                        ? 'Applying upgrade to PR...'
                        : `Apply Upgrade to v${activeItem.recommendedVersion} & Re-check PR`}
                    </span>
                  </button>
                  <p className="text-[11px] text-center text-slate-500 mt-1.5">
                    Applies the fix to your Pull Request and marks the security gate check as PASSED.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center border border-[#E8E3D5] shadow-xs space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">All Dependencies Are Clean</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                This project has no active vulnerabilities to simulate. You can reload the canonical vulnerable demo anytime.
              </p>
              {onRunDemo && (
                <button
                  onClick={onRunDemo}
                  className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Reload Vulnerable Demo App</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
