import React, { useState } from 'react';
import { Analysis } from '../types';
import { GitPullRequest, Check, X, RefreshCw, Lock, Unlock, Copy, Sparkles, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

interface PRGateViewProps {
  analysis: Analysis | null;
  onAnalysisUpdated: (newAnalysisId: string) => void;
  onResetDemo?: () => void;
}

export const PRGateView: React.FC<PRGateViewProps> = ({ analysis, onAnalysisUpdated, onResetDemo }) => {
  const [copied, setCopied] = useState(false);
  const [isPatching, setIsPatching] = useState(false);
  const [isMerged, setIsMerged] = useState(false);

  if (!analysis) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center text-slate-400 max-w-lg mx-auto my-8 border border-[#E8E3D5] shadow-xs">
        No active scan found. Click &quot;Reset Demo&quot; to test a Pull Request.
      </div>
    );
  }

  const isBlocked = analysis.gateStatus === 'BLOCKED';
  const threshold = analysis.gateThreshold || 70;

  const prCommentText = isBlocked
    ? `## 🛡️ RippleGuard Security Analysis

> ⚠️ **Pull Request Merge Blocked**
> Risk score \`${Math.round(analysis.riskScore)}/100\` exceeds your project's safety limit of \`${threshold}\`.

### 📊 Summary
- **Merge Status:** ❌ **BLOCKED**
- **Risk Score:** \`${Math.round(analysis.riskScore)} / 100\`
- **Problem Library:** \`crypto-core-pkg-c\` (v2.1.0)
- **Security Issue:** \`CVE-2024-8891\` (Severity: **9.8 / 10**)
- **Chance of Exploitation:** **87.0%** (High risk of real-world attack)

### 🛠️ Quick Fix
- **Action:** Upgrade \`crypto-core-pkg-c\` from \`2.1.0\` → **\`2.4.0\`**
- **Expected Risk Drop:** \`${Math.round(analysis.riskScore)}\` → \`0\` (**-100%**)
- **Result:** ✅ **Pull Request will become eligible to merge**

---
**Recommendation:** ❌ **DO NOT MERGE** until high-risk dependencies are upgraded.`
    : `## 🛡️ RippleGuard Security Analysis

**Merge Status:** ✅ **PASSED**
**Risk Score:** \`${Math.round(analysis.riskScore)}/100\` (Safety Limit: ${threshold})

All dependencies are clean. No blocking security risks detected.

**Recommendation:** ✅ **SAFE TO MERGE**`;

  const copyComment = () => {
    navigator.clipboard.writeText(prCommentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePushPatchedCommit = async (targetVersion = '2.4.0') => {
    try {
      setIsPatching(true);
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
            dependencies: { 'crypto-core-pkg-c': targetVersion },
          },
          'node_modules/billing-service-pkg-b': {
            version: '1.2.0',
            dependencies: { 'crypto-core-pkg-c': targetVersion },
          },
          'node_modules/crypto-core-pkg-c': {
            version: targetVersion,
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
        commitSha: 'commit-patched-' + targetVersion.replace(/\./g, ''),
        prNumber: analysis.prNumber || 104,
        threshold,
        isDemo: true,
      });

      setIsMerged(false);
      if (res && res.analysisId) {
        onAnalysisUpdated(res.analysisId);
      }
    } catch (err: any) {
      alert(`Error simulating patch: ${err.message}`);
    } finally {
      setIsPatching(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-[#E8E3D5] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-1">
            <GitPullRequest className="h-3.5 w-3.5" />
            <span>GitHub PR Check</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Pull Request Merge Gate
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Simulates the status check and branch protection enforcement inside GitHub.
          </p>
        </div>

        {isBlocked ? (
          <button
            onClick={() => handlePushPatchedCommit('2.4.0')}
            disabled={isPatching}
            className="shrink-0 flex items-center space-x-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPatching ? 'animate-spin' : ''}`} />
            <span>{isPatching ? 'Re-checking PR...' : 'Simulate Pushing Fix (v2.4.0)'}</span>
          </button>
        ) : (
          onResetDemo && (
            <button
              onClick={() => {
                setIsMerged(false);
                onResetDemo();
              }}
              className="shrink-0 flex items-center space-x-2 rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-all cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Reset to Vulnerable PR (Test Gate)</span>
            </button>
          )
        )}
      </div>

      {/* Merged Banner */}
      {isMerged && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-900">
                🎉 Pull Request #{analysis.prNumber || 104} Merged Successfully!
              </p>
              <p className="text-xs text-emerald-700">
                Branch protection verified 0 security violations. Code merged into main.
              </p>
            </div>
          </div>
          {onResetDemo && (
            <button
              onClick={() => {
                setIsMerged(false);
                onResetDemo();
              }}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
            >
              Test Again
            </button>
          )}
        </div>
      )}

      {/* GitHub PR Light Mockup */}
      <div className="rounded-2xl border border-[#E8E3D5] bg-white overflow-hidden shadow-xs">
        {/* Mock PR Title Header */}
        <div className="p-6 border-b border-[#E8E3D5] bg-[#FAF7EE]/60">
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-900">
              Upgrade core security and auth libraries
            </h2>
            <span className="text-slate-400 font-mono text-lg">#{analysis.prNumber || 104}</span>
          </div>
          <div className="mt-2 flex items-center space-x-2 text-xs text-slate-600">
            <span className="flex items-center px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
              <GitPullRequest className="h-3 w-3 mr-1" />
              {isMerged ? 'Merged' : 'Open'}
            </span>
            <span>
              wants to merge into <code className="bg-slate-200/80 px-1.5 py-0.5 rounded text-slate-800 font-mono">main</code> from <code className="bg-slate-200/80 px-1.5 py-0.5 rounded text-slate-800 font-mono">{analysis.branch || 'feature/crypto-upgrade-pr'}</code>
            </span>
          </div>
        </div>

        {/* PR Status & Branch Protection Box */}
        <div className="p-6 space-y-5">
          <div className="rounded-xl border border-[#E8E3D5] bg-[#FAF7EE]/40 p-5 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-600">
                Required Security Check
              </span>
              <span className="text-slate-500">Branch protection enabled</span>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-[#E8E3D5]">
              <div className="flex items-center space-x-3">
                {isBlocked ? (
                  <div className="h-7 w-7 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                    <X className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                    <Check className="h-4 w-4" />
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-slate-900 flex items-center">
                    <span>RippleGuard Security Gate</span>
                    <span className="ml-2 px-1.5 py-0.2 rounded text-[10px] bg-slate-200 text-slate-700 font-normal">
                      Required
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {isBlocked
                      ? `Risk score is ${Math.round(analysis.riskScore)}/100 (Exceeds safety limit of ${threshold})`
                      : `Risk score is ${Math.round(analysis.riskScore)}/100 (Clean and safe)`}
                  </p>
                </div>
              </div>

              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                  isBlocked
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {isBlocked ? 'FAILED' : 'PASSED'}
              </span>
            </div>

            {/* Merge Action Row */}
            <div className="pt-3 border-t border-[#E8E3D5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2 text-xs">
                {isBlocked ? (
                  <>
                    <Lock className="h-4 w-4 text-rose-600 shrink-0" />
                    <span className="text-rose-800 font-medium">
                      Merge blocked: Required check failed. Upgrade vulnerable libraries to proceed.
                    </span>
                  </>
                ) : isMerged ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-purple-600 shrink-0" />
                    <span className="text-purple-800 font-medium">
                      Pull Request merged into main.
                    </span>
                  </>
                ) : (
                  <>
                    <Unlock className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="text-emerald-800 font-medium">
                      All required checks passed. Ready to merge into main.
                    </span>
                  </>
                )}
              </div>

              <button
                disabled={isBlocked || isMerged}
                onClick={() => setIsMerged(true)}
                className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                  isBlocked || isMerged
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer'
                }`}
              >
                {isMerged ? 'Merged' : 'Merge pull request'}
              </button>
            </div>
          </div>

          {/* GitHub PR Bot Comment */}
          <div className="rounded-xl border border-[#E8E3D5] overflow-hidden">
            <div className="px-4 py-2 bg-[#FAF7EE] border-b border-[#E8E3D5] flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-800">rippleguard-bot</span>
                <span className="text-slate-500">commented</span>
              </div>
              <button
                onClick={copyComment}
                className="flex items-center space-x-1 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer text-[11px]"
              >
                <Copy className="h-3 w-3" />
                <span>{copied ? 'Copied!' : 'Copy Comment'}</span>
              </button>
            </div>

            <div className="p-5 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed bg-white">
              {prCommentText}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
