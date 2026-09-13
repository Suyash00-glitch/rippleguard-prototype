import React, { useState } from 'react';
import { api } from '../services/api';
import { Play, UploadCloud } from 'lucide-react';

interface ProjectAnalysisPageProps {
  onAnalysisCreated: (analysisId: string) => void;
}

export const ProjectAnalysisPage: React.FC<ProjectAnalysisPageProps> = ({ onAnalysisCreated }) => {
  const [projectName, setProjectName] = useState('My-Application-Service');
  const [repoUrl, setRepoUrl] = useState('https://github.com/my-org/service-repo');
  const [ecosystem, setEcosystem] = useState('npm');
  const [filename, setFilename] = useState('package-lock.json');
  const [threshold, setThreshold] = useState(70);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadPreset = (type: 'canonical' | 'safe' | 'python') => {
    if (type === 'canonical') {
      setProjectName('Sample Vulnerable App (DAG A,B → C)');
      setEcosystem('npm');
      setFilename('package-lock.json');
      setContent(JSON.stringify({
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
              'logger-util-pkg-d': '2.0.1'
            }
          },
          'node_modules/auth-service-pkg-a': {
            version: '1.0.0',
            dependencies: { 'crypto-core-pkg-c': '2.1.0' }
          },
          'node_modules/billing-service-pkg-b': {
            version: '1.2.0',
            dependencies: { 'crypto-core-pkg-c': '2.1.0' }
          },
          'node_modules/crypto-core-pkg-c': {
            version: '2.1.0'
          },
          'node_modules/logger-util-pkg-d': {
            version: '2.0.1',
            dependencies: { 'formatting-helper-pkg-e': '1.0.0' }
          },
          'node_modules/formatting-helper-pkg-e': {
            version: '1.0.0'
          }
        }
      }, null, 2));
    } else if (type === 'safe') {
      setProjectName('Clean Verified Utility');
      setEcosystem('npm');
      setFilename('package.json');
      setContent(JSON.stringify({
        name: 'clean-verified-utility',
        version: '2.0.0',
        dependencies: {
          'date-fns': '3.6.0',
          'clsx': '2.1.1'
        }
      }, null, 2));
    } else if (type === 'python') {
      setProjectName('Python Microservice');
      setEcosystem('pypi');
      setFilename('requirements.txt');
      setContent(`flask==1.1.2\njinja2==2.11.2\nurllib3==1.26.4\nrequests==2.25.1`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setErrorMsg('Please enter or upload dependency manifest / lockfile content');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const res = await api.runAnalysis({
        projectName,
        repoUrl,
        ecosystem,
        filename,
        content,
        threshold,
        isDemo: true,
      });

      onAnalysisCreated(res.analysisId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit analysis');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFilename(file.name);
      const reader = new FileReader();
      reader.onload = event => {
        setContent((event.target?.result as string) || '');
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Scan a Dependency File</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Paste or upload a manifest or lockfile to analyze vulnerabilities, build the dependency tree, and calculate risk.
        </p>
      </div>

      {/* Preset Options */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-1">Presets:</span>
        <button
          type="button"
          onClick={() => loadPreset('canonical')}
          className="rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
        >
          Canonical Vulnerable App (DAG A,B → C)
        </button>
        <button
          type="button"
          onClick={() => loadPreset('safe')}
          className="rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
        >
          Safe Clean Project
        </button>
        <button
          type="button"
          onClick={() => loadPreset('python')}
          className="rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
        >
          Python requirements.txt
        </button>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Safety Threshold (0–100)
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={threshold}
              onChange={e => setThreshold(parseFloat(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Ecosystem
            </label>
            <select
              value={ecosystem}
              onChange={e => setEcosystem(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-xs cursor-pointer"
            >
              <option value="npm">JavaScript / Node (npm)</option>
              <option value="pypi">Python (pypi)</option>
              <option value="maven">Java (maven)</option>
              <option value="golang">Go (golang)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Manifest Filename
            </label>
            <input
              type="text"
              value={filename}
              onChange={e => setFilename(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
              required
            />
          </div>
        </div>

        {/* Content Area */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              File Content (JSON or Text)
            </label>
            <label className="cursor-pointer text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center">
              <UploadCloud className="h-3.5 w-3.5 mr-1" />
              <span>Choose File</span>
              <input type="file" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
          <textarea
            rows={8}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={`Paste contents of ${filename} here...`}
            className="w-full p-3.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-500 focus:bg-white resize-y"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 py-3 text-xs font-bold text-white shadow-sm transition-all disabled:opacity-50 flex items-center justify-center space-x-1.5 cursor-pointer"
        >
          <Play className={`h-3.5 w-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
          <span>{isSubmitting ? 'Analyzing Dependencies...' : 'Run Security Analysis'}</span>
        </button>
      </form>
    </div>
  );
};
