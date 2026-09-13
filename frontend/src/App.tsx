import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { OverviewPage } from './pages/OverviewPage';
import { ProjectAnalysisPage } from './pages/ProjectAnalysisPage';
import { DependencyGraphView } from './components/DependencyGraphView';
import { VulnerabilityTable } from './components/VulnerabilityTable';
import { RemediationSimulatorView } from './components/RemediationSimulatorView';
import { PRGateView } from './components/PRGateView';
import { HistoryPage } from './pages/HistoryPage';
import { Analysis, FlowNodeData } from './types';
import { api } from './services/api';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export function App() {
  const [currentTab, setCurrentTab] = useState('overview');
  const [currentAnalysis, setCurrentAnalysis] = useState<Analysis | null>(null);
  const [graphData, setGraphData] = useState<{
    nodes: Array<{ id: string; type: string; data: FlowNodeData }>;
    edges: Array<{ id: string; source: string; target: string; animated?: boolean }>;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const loadAnalysisData = async (analysisId: string) => {
    try {
      setIsLoading(true);
      const analysis = await api.getAnalysis(analysisId);
      setCurrentAnalysis(analysis);

      const graph = await api.getGraph(analysisId);
      setGraphData(graph);
    } catch (err: any) {
      console.error('Failed fetching analysis data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial auto-load: fetch most recent analysis, or trigger demo if empty
  useEffect(() => {
    api.getAnalyses()
      .then(async list => {
        if (list && list.length > 0) {
          loadAnalysisData(list[0].id);
        } else {
          // Auto-trigger demo for seamless out-of-the-box experience
          handleRunDemo();
        }
      })
      .catch(() => {
        handleRunDemo();
      });
  }, []);

  const handleRunDemo = async () => {
    try {
      setIsLoadingDemo(true);
      const res = await api.loadCanonicalDemo();
      await loadAnalysisData(res.analysisId);
      setCurrentTab('overview');
      showNotification('Loaded Canonical Demo Project (DAG: App → A, B → C)');
    } catch (err: any) {
      alert(`Could not load demo: ${err.message}`);
    } finally {
      setIsLoadingDemo(false);
    }
  };

  const handleAnalysisCreated = async (analysisId: string) => {
    await loadAnalysisData(analysisId);
    setCurrentTab('overview');
    showNotification('Analysis completed successfully!');
  };

  const handleSelectRemediate = (packageName: string, fixedVersion: string) => {
    setCurrentTab('remediation');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-slate-900 font-sans">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center space-x-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xl shadow-blue-600/30 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Navigation Header */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        currentAnalysis={currentAnalysis}
        onRunDemo={handleRunDemo}
        isLoadingDemo={isLoadingDemo}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading && (
          <div className="text-center py-6 text-xs text-blue-600 font-medium animate-pulse">
            Loading scan data...
          </div>
        )}

        {currentTab === 'overview' && (
          <OverviewPage
            analysis={currentAnalysis}
            onNavigateTab={setCurrentTab}
            onRemediate={handleSelectRemediate}
          />
        )}

        {currentTab === 'analysis' && (
          <ProjectAnalysisPage onAnalysisCreated={handleAnalysisCreated} />
        )}

        {currentTab === 'graph' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Dependency Map</h1>
                <p className="text-xs text-slate-500 mt-1">
                  See how all your libraries connect to your app. Red boxes have security issues that need your attention.
                </p>
              </div>
              <span className="text-xs font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                {graphData?.nodes.length || 0} Total Libraries
              </span>
            </div>

            {graphData ? (
              <DependencyGraphView
                initialNodes={graphData.nodes}
                initialEdges={graphData.edges}
                onSelectRemediate={handleSelectRemediate}
              />
            ) : (
              <div className="bg-white rounded-xl p-16 text-center text-slate-500 border border-slate-200">
                Loading dependency map...
              </div>
            )}
          </div>
        )}

        {currentTab === 'vulnerabilities' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Security Issues Found</h1>
              <p className="text-xs text-slate-500 mt-1">
                Security flaws reported in your project libraries, cross-referenced with real-world attack data.
              </p>
            </div>
            <VulnerabilityTable
              vulnerabilities={currentAnalysis?.vulnerabilities || []}
              packages={currentAnalysis?.packages || []}
              onRemediate={handleSelectRemediate}
            />
          </div>
        )}

        {currentTab === 'remediation' && currentAnalysis && (
          <RemediationSimulatorView
            analysisId={currentAnalysis.id}
            remediations={currentAnalysis.remediations || []}
            currentRiskScore={currentAnalysis.riskScore}
            threshold={currentAnalysis.gateThreshold}
            onRunDemo={handleRunDemo}
            onApplyFix={async (newAnalysisId: string) => {
              if (newAnalysisId) {
                await loadAnalysisData(newAnalysisId);
              } else {
                const list = await api.getAnalyses();
                if (list && list.length > 0) {
                  await loadAnalysisData(list[0].id);
                }
              }
              showNotification('Fix applied! Risk dropped to 0. Pull Request is now safe to merge!', 'success');
              setCurrentTab('gate');
            }}
          />
        )}

        {currentTab === 'gate' && (
          <PRGateView
            analysis={currentAnalysis}
            onAnalysisUpdated={async (newAnalysisId: string) => {
              await loadAnalysisData(newAnalysisId);
              showNotification('Check updated! Code passed branch protection rules.', 'success');
            }}
            onResetDemo={handleRunDemo}
          />
        )}

        {currentTab === 'history' && (
          <HistoryPage
            onSelectAnalysis={id => {
              loadAnalysisData(id);
              setCurrentTab('overview');
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/80 bg-surface/50 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>RippleGuard Prototype — Contextual Supply-Chain Risk Engine</span>
          <span className="font-mono text-slate-400">OSV.dev • FIRST EPSS • Graph DAG • PR Gate Check</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
