'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Video, Music, FolderOpen, Plus, ArrowRight, Sparkles, TrendingUp } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { sourceVideosApi, musicTracksApi, projectsApi } from '@/lib/api';

interface Stats {
  videos: number;
  music: number;
  projects: number;
  completed: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ videos: 0, music: 0, projects: 0, completed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [videos, music, projects] = await Promise.all([
          sourceVideosApi.list(1, 1),
          musicTracksApi.list(),
          projectsApi.list(1, 100),
        ]);
        
        setStats({
          videos: videos.total,
          music: music.total,
          projects: projects.total,
          completed: projects.items.filter((p: { status: string }) => p.status === 'completed').length,
        });
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const statCards = [
    { label: 'Source Videos', value: stats.videos, icon: Video, href: '/dashboard/videos', color: 'from-blue-500 to-cyan-500' },
    { label: 'Music Tracks', value: stats.music, icon: Music, href: '/dashboard/music', color: 'from-purple-500 to-pink-500' },
    { label: 'Total Projects', value: stats.projects, icon: FolderOpen, href: '/dashboard/projects', color: 'from-orange-500 to-amber-500' },
    { label: 'Completed', value: stats.completed, icon: TrendingUp, href: '/dashboard/projects?status=completed', color: 'from-green-500 to-emerald-500' },
  ];

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-slate-400">Welcome back! Here&apos;s an overview of your video editing workspace.</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card hover className="group cursor-pointer">
          <Link href="/dashboard/projects/new">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white group-hover:text-violet-400 transition-colors">
                  New Project
                </h3>
                <p className="text-slate-400 text-sm">Start editing a video with AI-powered tools</p>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Link>
        </Card>

        <Card hover className="group cursor-pointer">
          <Link href="/dashboard/videos">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Video className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white group-hover:text-cyan-400 transition-colors">
                  Upload Video
                </h3>
                <p className="text-slate-400 text-sm">Add a new source video to your library</p>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card hover className="h-full">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-3xl font-bold text-white mb-1">
                    {loading ? '-' : stat.value}
                  </p>
                  <p className="text-slate-400 text-sm">{stat.label}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Features Section */}
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-6 h-6 text-violet-500" />
            <h2 className="text-xl font-semibold text-white">AI-Powered Features</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: 'Auto Subtitles', desc: '16 premium subtitle styles with word-level timing' },
              { title: 'Smart B-Roll', desc: 'AI identifies perfect moments for visual enhancements' },
              { title: 'Shorts Generator', desc: 'Extract viral clips from long-form content' },
            ].map((feature) => (
              <div key={feature.title} className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <h3 className="font-medium text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
