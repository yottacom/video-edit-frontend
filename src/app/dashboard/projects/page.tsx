'use client';

import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, Play, Clock, CheckCircle, XCircle, Loader2, Trash2, X, RefreshCw } from 'lucide-react';
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

const processingStatuses = new Set(['pending', 'transcribing', 'planning', 'generating', 'rendering']);

function isProcessingStatus(status: string) {
  return processingStatuses.has(status);
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<EditProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [previewProject, setPreviewProject] = useState<EditProject | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didInitialLoadRef = useRef(false);

  const loadProjects = useCallback(async (mode: 'initial' | 'refresh' = 'refresh') => {
    if (mode === 'refresh') {
      setRefreshing(true);
    }

    try {
      const data = await projectsApi.list(1, 50);
      setProjects(data.items);
      setPreviewProject((currentPreview) => {
        if (!currentPreview) return currentPreview;

        const refreshedPreview = data.items.find((project: EditProject) => project.id === currentPreview.id);
        return refreshedPreview ?? currentPreview;
      });
      return data.items as EditProject[];
    } catch (error) {
      console.error('Failed to load projects:', error);
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const hasProcessingProjects = projects.some((project) => isProcessingStatus(project.status));

  const pollProjectStatuses = useEffectEvent(async () => {
    const processingProjects = projects.filter((project) => isProcessingStatus(project.status));
    if (processingProjects.length === 0) {
      return false;
    }

    const currentProjectsById = new Map(processingProjects.map((project) => [project.id, project]));
    const updates = new Map<string, Partial<EditProject>>();
    let stillProcessing = false;

    const results = await Promise.allSettled(
      processingProjects.map(async (project) => ({
        id: project.id,
        data: await projectsApi.poll(project.id),
      }))
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') {
        stillProcessing = true;
        console.error('Failed to poll project status:', result.reason);
        continue;
      }

      const currentProject = currentProjectsById.get(result.value.id);
      const mergedProject = {
        ...currentProject,
        ...result.value.data,
        id: result.value.id,
      };

      updates.set(result.value.id, mergedProject);

      if (mergedProject.status && isProcessingStatus(mergedProject.status)) {
        stillProcessing = true;
      }
    }

    if (updates.size > 0) {
      setProjects((currentProjects) =>
        currentProjects.map((project) => {
          const update = updates.get(project.id);
          return update ? { ...project, ...update } : project;
        })
      );

      setPreviewProject((currentPreview) => {
        if (!currentPreview) return currentPreview;

        const update = updates.get(currentPreview.id);
        return update ? { ...currentPreview, ...update } : currentPreview;
      });
    }

    return stillProcessing;
  });

  useEffect(() => {
    if (didInitialLoadRef.current) return;

    didInitialLoadRef.current = true;
    void loadProjects('initial');
  }, [loadProjects]);

  useEffect(() => {
    if (!previewProject) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewProject(null);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewProject]);

  useEffect(() => {
    if (!hasProcessingProjects) {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const pollProjects = async () => {
      const stillProcessing = await pollProjectStatuses();
      if (cancelled) return;

      if (stillProcessing) {
        pollTimeoutRef.current = setTimeout(() => {
          void pollProjects();
        }, 5000);
      }
    };

    pollTimeoutRef.current = setTimeout(() => {
      void pollProjects();
    }, 5000);

    return () => {
      cancelled = true;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [hasProcessingProjects]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await projectsApi.delete(id);
      setProjects((currentProjects) => currentProjects.filter((project) => project.id !== id));
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  return (
    <DashboardLayout>
      {previewProject && previewProject.output_url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
          onClick={() => setPreviewProject(null)}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-6 border-b border-slate-800 px-6 py-5">
              <div className="min-w-0">
                <p className="text-sm uppercase tracking-[0.3em] text-violet-300/80">Project Preview</p>
                <h2 className="mt-1 truncate text-xl font-semibold text-white">{previewProject.title}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400">
                  <span>{(statusConfig[previewProject.status] || statusConfig.draft).label}</span>
                  <span>{new Date(previewProject.created_at).toLocaleDateString()}</span>
                  {typeof previewProject.progress === 'number' && previewProject.progress > 0 && (
                    <span>{previewProject.progress}% complete</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewProject(null)}
                className="rounded-full border border-slate-700 p-2 text-slate-400 transition-colors hover:border-slate-500 hover:text-white"
                aria-label="Close preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-black">
              <video
                key={previewProject.id}
                src={previewProject.output_url}
                controls
                autoPlay
                playsInline
                className="max-h-[72vh] w-full bg-black"
              />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Projects</h1>
          <p className="text-slate-400">Manage your video editing projects</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              void loadProjects('refresh');
            }}
            loading={refreshing}
            disabled={loading}
          >
            {!refreshing && <RefreshCw className="w-5 h-5" />}
            Refresh
          </Button>
          <Link href="/dashboard/projects/new">
            <Button>
              <Plus className="w-5 h-5" />
              New Project
            </Button>
          </Link>
        </div>
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
            const isProcessing = isProcessingStatus(project.status);
            
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
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setPreviewProject(project)}
                        >
                          <Play className="w-4 h-4" />
                          View
                        </Button>
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
