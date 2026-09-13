import React from 'react';
import { X, ArrowRight, Info } from 'lucide-react';
import { FlowNodeData } from '../types';

interface NodeDetailDrawerProps {
  nodeData: FlowNodeData | null;
  onClose: () => void;
  onSelectRemediate?: (packageName: string, fixedVersion: string) => void;
}

export const NodeDetailDrawer: React.FC<NodeDetailDrawerProps> = ({
  nodeData,
  onClose,
  onSelectRemediate,
}) => {
  if (!nodeData) return null;

  const isRoot = nodeData.isRoot;
  const risk = nodeData.effectiveRisk || 0;
  const isHighRisk = risk >= 70;

  return (
    <div className="absolute right-5 top-5 bottom-5 w-96 rounded-2xl bg-white border border-slate-300 shadow-xl z-30 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-5 border-b border-slate-200 flex items-start justify-between bg-slate-50">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
            {isRoot ? 'Application Entry' : 'Library Inspector'}
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5 break-all">{nodeData.label}</h2>
          {!isRoot && (
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              v{nodeData.version} ({nodeData.isDirect ? 'Direct Dependency' : 'Nested Dependency'})
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Risk Box */}
        <div
          className={`p-4 rounded-xl border ${
            isHighRisk
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : risk > 0
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider">Danger Level</span>
            <span className="text-xl font-extrabold font-mono">{Math.round(risk)} / 100</span>
          </div>
          <p className="text-xs mt-1 leading-relaxed text-slate-600">
            {isHighRisk
              ? 'Contains critical security issues. Blocks Pull Request from merging.'
              : risk > 0
              ? 'Moderate risk score. Recommended to monitor.'
              : 'Clean library with no known security disclosures.'}
          </p>
        </div>

        {/* Metrics */}
        {!isRoot && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Dependency Impact
            </h3>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">Direct Dependents:</span>
                <p className="text-base font-bold text-slate-900 mt-0.5">{nodeData.directDependents || 0} packages</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">Impact Score:</span>
                <p className="text-base font-bold text-slate-900 mt-0.5">{nodeData.blastRadius || 0} / 100</p>
              </div>
            </div>
          </div>
        )}

        {/* Plain English Tip */}
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900 space-y-1">
          <p className="font-bold flex items-center">
            <Info className="h-4 w-4 mr-1.5 text-blue-600 shrink-0" />
            Understanding the Graph:
          </p>
          <p className="text-blue-800 leading-relaxed text-[11px]">
            Arrows show what depends on what. If this library is compromised, the risk travels up to all parents that use it.
          </p>
        </div>

        {/* Fix Call to Action */}
        {nodeData.fixedVersion && onSelectRemediate && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
              Patch Available
            </span>
            <p className="text-sm font-bold text-slate-900">
              Upgrade to version {nodeData.fixedVersion}
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Upgrading resolves this vulnerability and clears the merge block.
            </p>
            <button
              onClick={() => onSelectRemediate(nodeData.label, nodeData.fixedVersion!)}
              className="w-full flex items-center justify-center space-x-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-semibold transition-all shadow-sm cursor-pointer mt-1"
            >
              <span>Test This Fix</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
