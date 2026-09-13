import React from 'react';
import { Shield, Play, GitPullRequest, GitGraph, Sparkles, UploadCloud, History } from 'lucide-react';
import { Analysis } from '../types';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentAnalysis: Analysis | null;
  onRunDemo: () => void;
  isLoadingDemo: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  currentAnalysis,
  onRunDemo,
  isLoadingDemo,
}) => {
  const primaryTabs = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'graph', label: 'Dependency Map', icon: GitGraph },
    { id: 'remediation', label: 'Fix Simulator', icon: Sparkles },
    { id: 'gate', label: 'PR Check', icon: GitPullRequest },
  ];

  const isBlocked = currentAnalysis?.gateStatus === 'BLOCKED';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#E8E3D5] bg-[#FAF7EE]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
        {/* Brand */}
        <div 
          className="flex items-center space-x-2.5 cursor-pointer group"
          onClick={() => setCurrentTab('overview')}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 shadow-sm text-white">
            <Shield className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
            RippleGuard
          </span>
        </div>

        {/* Clean Center Navigation Tabs */}
        <nav className="hidden md:flex items-center space-x-1 rounded-xl bg-[#EFE9D8] p-1 border border-[#DFD8C5]">
          {primaryTabs.map(tab => {
            const Icon = tab.icon;
            const active = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`flex items-center space-x-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-[#E5DEC9]'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}

          <div className="h-4 w-px bg-[#D6CEBE] mx-1" />

          {/* Secondary links */}
          <button
            onClick={() => setCurrentTab('analysis')}
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              currentTab === 'analysis'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-[#E5DEC9]'
            }`}
          >
            <UploadCloud className="h-3.5 w-3.5" />
            <span>Scan File</span>
          </button>

          <button
            onClick={() => setCurrentTab('history')}
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              currentTab === 'history'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-[#E5DEC9]'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>History</span>
          </button>
        </nav>

        {/* Right Status & Demo */}
        <div className="flex items-center space-x-3">
          {currentAnalysis && (
            <div
              onClick={() => setCurrentTab('gate')}
              className={`hidden sm:flex items-center space-x-2 rounded-full px-3 py-1 text-xs font-semibold border cursor-pointer transition-colors ${
                isBlocked
                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${isBlocked ? 'bg-rose-500' : 'bg-emerald-500'}`} />
              <span>{isBlocked ? `Blocked (${Math.round(currentAnalysis.riskScore)})` : `Allowed (${Math.round(currentAnalysis.riskScore)})`}</span>
            </div>
          )}

          <button
            onClick={onRunDemo}
            disabled={isLoadingDemo}
            className="flex items-center space-x-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-1.5 text-xs font-semibold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Play className={`h-3.5 w-3.5 ${isLoadingDemo ? 'animate-spin' : ''}`} />
            <span>{isLoadingDemo ? 'Loading...' : 'Reset Demo'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Tab Row */}
      <div className="flex md:hidden overflow-x-auto border-t border-slate-200 px-4 py-2 space-x-1.5 scrollbar-none bg-slate-50">
        {[...primaryTabs, { id: 'analysis', label: 'Scan', icon: UploadCloud }, { id: 'history', label: 'History', icon: History }].map(tab => {
          const Icon = tab.icon;
          const active = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`flex shrink-0 items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                active ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-600 bg-transparent'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
