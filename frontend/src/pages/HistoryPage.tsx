import React, { useEffect, useState } from 'react';
import { Analysis } from '../types';
import { api } from '../services/api';
import { History, ShieldAlert, ShieldCheck, ArrowRight, Clock, GitBranch } from 'lucide-react';

interface HistoryPageProps {
  onSelectAnalysis: (id: string) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ onSelectAnalysis }) => {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.getAnalyses()
      .then(res => setAnalyses(res))
      .catch(err => console.error('Failed loading history:', err))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center">
            <History className="h-5 w-5 mr-2 text-blue-600" />
            Check History & Audit Log
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Past Pull Request scans, calculated risk scores, and merge decisions.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          {analyses.length} Total Runs
        </span>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl p-12 text-center text-slate-500 border border-slate-200 shadow-xs">
          Loading history records...
        </div>
      ) : analyses.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center text-slate-500 border border-slate-200 shadow-xs">
          No analysis history found. Run a new scan to populate this view.
        </div>
      ) : (
        <div className="space-y-3">
          {analyses.map(item => {
            const isBlocked = item.gateStatus === 'BLOCKED';
            return (
              <div
                key={item.id}
                onClick={() => onSelectAnalysis(item.id)}
                className="bg-white hover:bg-slate-50 rounded-xl p-4 border border-slate-200 hover:border-slate-300 cursor-pointer flex items-center justify-between transition-all shadow-xs"
              >
                <div className="flex items-center space-x-4">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isBlocked
                        ? 'bg-rose-50 text-rose-600 border border-rose-200'
                        : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    }`}
                  >
                    {isBlocked ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-bold text-sm text-slate-900">{item.project?.name || 'Analyzed Project'}</h4>
                      <span className="text-xs text-slate-500 font-mono">#{item.prNumber || 'PR'}</span>
                      {item.isDemo && (
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-semibold">
                          DEMO
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center space-x-3 text-xs text-slate-500">
                      <span className="flex items-center">
                        <GitBranch className="h-3 w-3 mr-1" />
                        {item.branch || 'main'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                      <span>•</span>
                      <span>{item.totalDependencies} libraries</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-6">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Risk Score</span>
                    <span
                      className={`text-lg font-bold font-mono ${
                        isBlocked ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {item.riskScore.toFixed(1)} / 100
                    </span>
                  </div>

                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
                      isBlocked
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {isBlocked ? 'BLOCKED' : 'PASSED'}
                  </span>

                  <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-700" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
