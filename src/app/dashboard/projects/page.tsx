'use client';

import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, Play, Clock, CheckCircle, XCircle, Loader2, Trash2, RefreshCw } from 'lucide-react';
import { InlineVideoPlayer } from '@/components/media/InlineVideoPlayer';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
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
  const [projectToDelete, setProjectToDelete] = useState<EditProject | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didInitialLoadRef = useRef(false);

  const loadProjects = useCallback(async (mode: 'initial' | 'refresh' = 'refresh') => {
    if (mode === 'refresh') {
      setRefreshing(true);
    }

    try {
      const data = await projectsApi.list(1, 50);
      setProjects(data.items);
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
    }

    return stillProcessing;
  });

  useEffect(() => {
    if (didInitialLoadRef.current) return;

    didInitialLoadRef.current = true;
    void loadProjects('initial');
  }, [loadProjects]);

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

  const handleDelete = async () => {
    if (!projectToDelete) return;

    setDeletingProjectId(projectToDelete.id);

    try {
      await projectsApi.delete(projectToDelete.id);
      setProjects((currentProjects) => currentProjects.filter((project) => project.id !== projectToDelete.id));
      setProjectToDelete(null);
    } catch (error) {
      console.error('Failed to delete project:', error);
    } finally {
      setDeletingProjectId(null);
    }
  };

  return (
    <DashboardLayout>
      <ConfirmDialog
        open={!!projectToDelete}
        title="Delete project?"
        description={
          projectToDelete
            ? `"${projectToDelete.title}" and its generated outputs will be permanently removed.`
            : ''
        }
        confirmLabel="Delete Project"
        loading={deletingProjectId === projectToDelete?.id}
        onClose={() => {
          if (!deletingProjectId) {
            setProjectToDelete(null);
          }
        }}
        onConfirm={() => {
          void handleDelete();
        }}
      />

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-white">Projects</h1>
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
            {!refreshing && <RefreshCw className="h-5 w-5" />}
            Refresh
          </Button>
          <Link href="/dashboard/projects/new">
            <Button>
              <Plus className="h-5 w-5" />
              New Project
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-800">
              <Play className="h-10 w-10 text-slate-600" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-white">No projects yet</h3>
            <p className="mb-6 text-slate-400">Create your first video editing project</p>
            <Link href="/dashboard/projects/new">
              <Button>
                <Plus className="h-5 w-5" />
                Create Project
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const status = statusConfig[project.status] || statusConfig.draft;
            const StatusIcon = status.icon;
            const isProcessing = isProcessingStatus(project.status);

            return (
              <Card key={project.id} hover className="flex h-full flex-col overflow-hidden">
                <div className="border-b border-slate-700/50 bg-slate-900/70">
                  {project.output_url ? (
                    <InlineVideoPlayer
                      key={project.output_url}
                      videoUrl={project.output_url}
                      title={project.title}
                      className="rounded-none"
                    />
                  ) : (
                    <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.22),transparent_55%)]" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className={`flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-slate-950/70 ${status.color}`}>
                          <StatusIcon className={`h-7 w-7 ${isProcessing ? 'animate-spin' : ''}`} />
                        </div>
                      </div>
                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <p className="text-sm font-medium text-white/95">{status.label}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.25em] text-white/50">
                          {isProcessing ? 'Project is processing' : 'Preview unavailable'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <CardContent className="flex flex-1 flex-col p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold text-white">{project.title}</h3>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                        <span className={`inline-flex items-center gap-2 rounded-full bg-slate-900 px-2.5 py-1 ${status.color}`}>
                          <StatusIcon className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
                          {status.label}
                        </span>
                        <span className="text-slate-500">{new Date(project.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setProjectToDelete(project)}
                      className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-900 hover:text-red-400"
                      aria-label={`Delete ${project.title}`}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>

                  {isProcessing && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm text-slate-400">
                        <span>Progress</span>
                        <span>{project.progress}%</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-900">
                        <div
                          className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all duration-500"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="mb-5 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs text-slate-300">
                      {project.config.subtitle_style}
                    </span>
                    {project.config.add_broll && (
                      <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-xs text-violet-300">
                        B-Roll
                      </span>
                    )}
                    {project.config.broll_sfx && (
                      <span className="rounded-full bg-fuchsia-500/15 px-2.5 py-1 text-xs text-fuchsia-300">
                        SFX
                      </span>
                    )}
                    {project.config.music_track_id && (
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-300">
                        Music
                      </span>
                    )}
                    {project.config.generate_shorts && (
                      <span className="rounded-full bg-cyan-500/15 px-2.5 py-1 text-xs text-cyan-300">
                        Shorts: {project.config.shorts_count}
                      </span>
                    )}
                  </div>

                  <div className="mt-auto flex items-center gap-2">
                    <Link href={`/dashboard/projects/${project.id}`} className="flex-1">
                      <Button variant="secondary" className="w-full" size="sm">
                        Details
                      </Button>
                    </Link>
                    {project.output_url && (
                      <a href={project.output_url} download className="flex-1">
                        <Button variant="outline" className="w-full" size="sm">
                          Download
                        </Button>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
