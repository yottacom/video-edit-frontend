'use client';

import { useState } from 'react';
import { Bug, X, ChevronDown, ChevronRight, Trash2, Copy, Check } from 'lucide-react';
import { useDebugStore, ApiCall } from '@/lib/debug-store';

function JsonViewer({ data, label }: { data: any; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  
  if (!data) return null;
  
  const jsonString = JSON.stringify(data, null, 2);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="mt-2">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-white"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {label}
      </button>
      {expanded && (
        <div className="relative mt-1">
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1 rounded bg-slate-700 hover:bg-slate-600 transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
          </button>
          <pre className="p-3 rounded bg-slate-900 text-xs text-slate-300 overflow-x-auto max-h-48 overflow-y-auto">
            {jsonString}
          </pre>
        </div>
      )}
    </div>
  );
}

function ApiCallItem({ call }: { call: ApiCall }) {
  const [expanded, setExpanded] = useState(false);
  
  const statusColor = !call.status 
    ? 'text-yellow-400' 
    : call.status >= 200 && call.status < 300 
      ? 'text-green-400' 
      : 'text-red-400';
  
  const methodColors: Record<string, string> = {
    GET: 'bg-blue-500/20 text-blue-400',
    POST: 'bg-green-500/20 text-green-400',
    PUT: 'bg-orange-500/20 text-orange-400',
    PATCH: 'bg-yellow-500/20 text-yellow-400',
    DELETE: 'bg-red-500/20 text-red-400',
  };
  
  return (
    <div className="border-b border-slate-700 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center gap-3 hover:bg-slate-800/50 transition-colors text-left"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
        
        <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${methodColors[call.method] || 'bg-slate-700 text-slate-300'}`}>
          {call.method}
        </span>
        
        <span className="flex-1 text-sm text-slate-300 truncate font-mono">
          {call.url.replace(process.env.NEXT_PUBLIC_API_URL || 'https://video-edit.yt1.co', '')}
        </span>
        
        <span className={`text-sm font-medium ${statusColor}`}>
          {call.status || '...'}
        </span>
        
        {call.duration && (
          <span className="text-xs text-slate-500">
            {call.duration}ms
          </span>
        )}
        
        <span className="text-xs text-slate-600">
          {new Date(call.timestamp).toLocaleTimeString()}
        </span>
      </button>
      
      {expanded && (
        <div className="px-4 pb-3 pl-10 space-y-2">
          <div className="text-xs text-slate-500 font-mono break-all">{call.url}</div>
          
          {call.error && (
            <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {call.error}
            </div>
          )}
          
          <JsonViewer data={call.requestBody} label="Request Body" />
          <JsonViewer data={call.responseBody} label="Response Body" />
        </div>
      )}
    </div>
  );
}

export function DebugOverlay() {
  const { calls, isOpen, toggleOpen, clearCalls } = useDebugStore();
  
  return (
    <>
      {/* Floating Button */}
      <button
        onClick={toggleOpen}
        className={`
          fixed bottom-4 right-4 z-50
          w-12 h-12 rounded-full
          flex items-center justify-center
          shadow-lg transition-all duration-200
          ${isOpen 
            ? 'bg-violet-600 hover:bg-violet-700' 
            : 'bg-slate-800 hover:bg-slate-700 border border-slate-700'}
          ${calls.some(c => c.error) ? 'ring-2 ring-red-500' : ''}
        `}
        title="API Debug"
      >
        <Bug className="w-5 h-5 text-white" />
        {calls.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-violet-500 text-xs text-white flex items-center justify-center font-medium">
            {calls.length > 99 ? '99+' : calls.length}
          </span>
        )}
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={toggleOpen}
          />
          
          {/* Panel */}
          <div className="relative w-full max-w-2xl max-h-[80vh] bg-slate-900 rounded-xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <Bug className="w-5 h-5 text-violet-500" />
                <h2 className="text-lg font-semibold text-white">API Debug</h2>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs text-slate-400">
                  {calls.length} calls
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearCalls}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  title="Clear all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={toggleOpen}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {calls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Bug className="w-12 h-12 mb-3 opacity-50" />
                  <p>No API calls yet</p>
                  <p className="text-sm text-slate-600">Calls will appear here as you use the app</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-700">
                  {calls.map((call) => (
                    <ApiCallItem key={call.id} call={call} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
