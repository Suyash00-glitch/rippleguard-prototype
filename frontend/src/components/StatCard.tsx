import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  color?: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple';
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon: Icon,
  color = 'blue',
}) => {
  const colorStyles = {
    blue: 'text-blue-700 bg-blue-50 border-blue-200',
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    amber: 'text-amber-700 bg-amber-50 border-amber-200',
    rose: 'text-rose-700 bg-rose-50 border-rose-200',
    purple: 'text-purple-700 bg-purple-50 border-purple-200',
  };

  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {subtext && (
            <p className="mt-1 text-xs text-slate-500">{subtext}</p>
          )}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg border ${colorStyles[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};
