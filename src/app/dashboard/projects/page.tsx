'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Play, Clock, CheckCircle, XCircle, Loader2, ExternalLink, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { projectsApi } from '@/lib/api';
import { EditProject } from '@/types';

const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  draft: { icon: Clock, color: 'text-slate-400', label: 'Draft' },
  pending: { icon: Clock, color: 'text-yellow-400', label: 'Pending' },
  transcribing: { icon: Loader2, color: 'text-blue-400', label: 'Transcribing' },
  planning: { icon: Loader2, color: 'text-purple-400', label: 'AI Planning' },
  generating: { icon: Loader2, color: 'text-orange-400', label: 'Generating' },
  rendering: { icon: Loader2, color: 'text-cyan-400', label: 'Rendering' },
  completed: { icon: CheckCircle, color: 'text-green-400', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Failed' },
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<EditProject[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = async () => {
    try {
      const data = await projectsApi.list(1, 50);
      setProjects(data.items);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
    
    // Poll for updates on processing projects
    const interval = setInterval(() => {
      const hasProcessing = projects.some(p => 
        ['pending', 'transcribing', 'planning', 'generating', 'rendering'].includes(p.status)
      );
      if (hasProcessing) {
        loadProjects();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [projects]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await projectsApi.delete(id);
      setProjects(projects.filter(p => p.id !== id));
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Projects</h1>
          <p className="text-slate-400">Manage your video editing projects</p>
        </div>
        <Link href="/dashboard/projects/new">
          <Button>
            <Plus className="w-5 h-5" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-4">
              <Play className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No projects yet</h3>
            <p className="text-slate-400 mb-6">Create your first video editing project</p>
            <Link href="/dashboard/projects/new">
              <Button>
                <Plus className="w-5 h-5" />
                Create Project
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => {
            const status = statusConfig[project.status] || statusConfig.draft;
            const StatusIcon = status.icon;
            const isProcessing = ['pending', 'transcribing', 'planning', 'generating', 'rendering'].includes(project.status);
            
            return (
              <Card key={project.id} hover>
                <CardContent className="p-6">
                  <div className="flex items-center gap-6">
                    {/* Status Icon */}
                    <div className={`w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center ${status.color}`}>
                      <StatusIcon className={`w-6 h-6 ${isProcessing ? 'animate-spin' : ''}`} />
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-white truncate">{project.title}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <span className={`text-sm ${status.color}`}>{status.label}</span>
                        {isProcessing && (
                          <span className="text-sm text-slate-500">{project.progress}%</span>
                        )}
                        <span className="text-sm text-slate-500">
                          {new Date(project.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      
                      {/* Progress Bar */}
                      {isProcessing && (
                        <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all duration-500"
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                      )}
                      
                      {/* Config Tags */}
                      <div className="flex gap-2 mt-3">
                        <span className="px-2 py-1 text-xs rounded bg-slate-800 text-slate-400">
                          {project.config.subtitle_style}
                        </span>
                        {project.config.add_broll && (
                          <span className="px-2 py-1 text-xs rounded bg-violet-500/20 text-violet-400">
                            B-Roll
                          </span>
                        )}
                        {project.config.generate_shorts && (
                          <span className="px-2 py-1 text-xs rounded bg-cyan-500/20 text-cyan-400">
                            Shorts: {project.config.shorts_count}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {project.status === 'completed' && project.output_url && (
                        <a href={project.output_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="secondary" size="sm">
                            <ExternalLink className="w-4 h-4" />
                            View
                          </Button>
                        </a>
                      )}
                      <Link href={`/dashboard/projects/${project.id}`}>
                        <Button variant="secondary" size="sm">Details</Button>
                      </Link>
                      <button 
                        onClick={() => handleDelete(project.id)}
                        className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Error Message */}
                  {project.status === 'failed' && project.error_message && (
                    <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      {project.error_message}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
