import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { RiskScoreDetails } from '../types';

interface RiskBreakdownChartProps {
  details?: RiskScoreDetails;
}

export const RiskBreakdownChart: React.FC<RiskBreakdownChartProps> = ({ details }) => {
  if (!details) {
    return (
      <div className="bg-white rounded-2xl p-6 flex items-center justify-center h-72 text-slate-400 text-xs border border-slate-200">
        No breakdown data available
      </div>
    );
  }

  const data = [
    { factor: 'Flaw Severity', score: Math.round(details.severityContrib), description: 'Base danger of the vulnerability (CVSS)', color: '#DC2626' },
    { factor: 'Attack Chance', score: Math.round(details.epssContrib), description: 'Probability of exploitation in the wild (EPSS)', color: '#EA580C' },
    { factor: 'Impact Area', score: Math.round(details.blastRadiusContrib), description: 'How many other libraries rely on this package', color: '#D97706' },
    { factor: 'Directness', score: Math.round(details.dependencyContrib), description: 'Direct dependency vs deeply nested', color: '#2563EB' },
    { factor: 'Spillover', score: Math.round(details.propagationContrib), description: 'Risk spreading upstream to main code', color: '#7C3AED' },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 flex flex-col justify-between border border-slate-200 shadow-sm h-full">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Risk Score Breakdown
          </h3>
          <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            5 Measured Factors
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Weighted contribution of each security and topological factor to the total danger score.
        </p>
      </div>

      <div className="h-56 mt-4 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 25, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
            <XAxis type="number" domain={[0, 40]} stroke="#94A3B8" fontSize={11} />
            <YAxis
              type="category"
              dataKey="factor"
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={90}
            />
            <Tooltip
              cursor={{ fill: '#F8FAFC' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  return (
                    <div className="rounded-lg bg-white border border-slate-200 p-2.5 shadow-md text-xs space-y-0.5">
                      <p className="font-bold text-slate-900">{item.factor}</p>
                      <p className="text-slate-500 text-[11px]">{item.description}</p>
                      <p className="text-blue-600 font-mono font-semibold mt-1">Impact: +{item.score} pts</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="score" radius={[0, 6, 6, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {details.fixFactorContrib > 0 && (
        <div className="mt-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center justify-between">
          <span>Available Patch Discount:</span>
          <span className="font-mono font-bold">-{details.fixFactorContrib} pts</span>
        </div>
      )}
    </div>
  );
};
