import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FlowNodeData } from '../types';
import { AlertCircle, CheckCircle2, Shield } from 'lucide-react';

export const CustomNode = memo(({ data, selected }: { data: FlowNodeData; selected?: boolean }) => {
  const isRoot = data.isRoot;
  const risk = data.effectiveRisk || 0;

  let borderClass = 'border-slate-300 bg-white';
  let badgeColor = 'bg-slate-100 text-slate-700';
  let riskLabel = 'Clean';
  let Icon = CheckCircle2;
  let iconColor = 'text-emerald-600';

  if (isRoot) {
    borderClass = 'border-blue-300 bg-blue-50/70 shadow-sm';
    badgeColor = 'bg-blue-100 text-blue-800';
    riskLabel = 'Your App (Root)';
    Icon = Shield;
    iconColor = 'text-blue-600';
  } else if (risk >= 70 || data.hasCritical || data.hasHigh) {
    borderClass = 'border-rose-400 bg-rose-50/80 shadow-md ring-1 ring-rose-300';
    badgeColor = 'bg-rose-100 text-rose-800 border border-rose-200';
    riskLabel = `CRITICAL (${Math.round(risk)})`;
    Icon = AlertCircle;
    iconColor = 'text-rose-600';
  } else if (risk >= 30) {
    borderClass = 'border-amber-300 bg-amber-50/70';
    badgeColor = 'bg-amber-100 text-amber-800';
    riskLabel = `MODERATE (${Math.round(risk)})`;
    Icon = AlertCircle;
    iconColor = 'text-amber-600';
  } else {
    borderClass = 'border-emerald-300 bg-emerald-50/50';
    badgeColor = 'bg-emerald-100 text-emerald-800';
    riskLabel = 'SAFE (0)';
    Icon = CheckCircle2;
    iconColor = 'text-emerald-600';
  }

  return (
    <div
      className={`px-4 py-3.5 rounded-xl border-2 transition-all min-w-[210px] shadow-sm ${borderClass} ${
        selected ? 'ring-2 ring-blue-600 ring-offset-2' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-2 !h-2" />

      <div className="flex items-start justify-between space-x-2">
        <div className="overflow-hidden">
          <div className="flex items-center space-x-1.5">
            <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
            <p className="font-bold text-xs text-slate-900 truncate max-w-[150px]" title={data.label}>
              {data.label}
            </p>
          </div>
          {!isRoot && (
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              v{data.version} • {data.isDirect ? 'Direct' : 'Nested'}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11px]">
        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${badgeColor}`}>
          {riskLabel}
        </span>
        {!isRoot && (
          <span className="text-slate-500 text-[10px]">
            Impact: <strong className="text-slate-800">{data.blastRadius || 0}</strong>
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-2 !h-2" />
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
