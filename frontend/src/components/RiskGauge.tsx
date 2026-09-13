import React from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

interface RiskGaugeProps {
  score: number;
  threshold: number;
  level: string;
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({ score, threshold, level }) => {
  const normalizedScore = Math.max(0, Math.min(100, score));
  const isBlocked = score >= threshold;

  const getColor = (s: number) => {
    if (s >= 85) return '#DC2626'; // Red 600
    if (s >= 70) return '#EA580C'; // Orange 600
    if (s >= 50) return '#D97706'; // Amber 600
    if (s >= 30) return '#2563EB'; // Blue 600
    return '#16A34A';              // Green 600
  };

  const currentColor = getColor(normalizedScore);

  const radius = 80;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl p-6 flex flex-col items-center text-center border border-slate-200 shadow-sm">
      <div className="w-full flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Merge Decision
        </span>
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          Limit: <strong className="text-slate-800">{threshold}/100</strong>
        </span>
      </div>

      {/* Arc Gauge */}
      <div className="relative flex items-center justify-center my-3">
        <svg width="200" height="110" className="overflow-visible">
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={currentColor}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>

        <div className="absolute bottom-0 flex flex-col items-center">
          <span className="text-4xl font-extrabold tracking-tight text-slate-900 font-mono">
            {Math.round(normalizedScore)}
          </span>
          <span
            className="mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide"
            style={{
              backgroundColor: `${currentColor}15`,
              color: currentColor,
              border: `1px solid ${currentColor}30`,
            }}
          >
            {level} Risk
          </span>
        </div>
      </div>

      {/* Status Box */}
      <div className="mt-5 w-full pt-4 border-t border-slate-100">
        {isBlocked ? (
          <div className="flex items-center space-x-2.5 rounded-xl bg-rose-50 p-3 border border-rose-200 text-rose-800 text-left">
            <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0" />
            <div>
              <p className="font-bold text-xs">MERGE BLOCKED</p>
              <p className="text-[11px] text-rose-700 mt-0.5">Score ({Math.round(score)}) exceeds safety limit ({threshold}).</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2.5 rounded-xl bg-emerald-50 p-3 border border-emerald-200 text-emerald-800 text-left">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-xs">SAFE TO MERGE</p>
              <p className="text-[11px] text-emerald-700 mt-0.5">Risk score is within allowable limits.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
