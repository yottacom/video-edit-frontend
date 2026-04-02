'use client';

import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, GripVertical, Plus, Scissors, Trash2 } from 'lucide-react';
import { VideoThumbnail } from '@/components/media/VideoThumbnail';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ProjectShortSegment } from '@/types';

const MIN_TIMELINE_DURATION_MS = 1000;
const MIN_SEGMENT_DURATION_MS = 500;
const SNAP_INCREMENT_MS = 100;
const THUMBNAIL_TILE_COUNT = 12;

type DragMode = 'move' | 'resize-start' | 'resize-end';

interface DragState {
  segmentIndex: number;
  mode: DragMode;
  startClientX: number;
  initialStartMs: number;
  initialEndMs: number;
  trackWidth: number;
}

interface ShortSegmentsTimelineEditorProps {
  videoUrl: string | null;
  thumbnailUrl?: string | null;
  segments: ProjectShortSegment[];
  timelineDurationMs: number;
  onChange: (segments: ProjectShortSegment[]) => void;
  onAddSegment: () => void;
  onDeleteSegment: (segmentIndex: number) => void;
  error?: string | null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToIncrement(value: number, increment: number) {
  return Math.round(value / increment) * increment;
}

function formatTimelineTime(ms: number) {
  const totalSeconds = Math.max(0, ms) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
}

function getTickInterval(durationMs: number) {
  if (durationMs <= 15_000) return 1_000;
  if (durationMs <= 30_000) return 2_500;
  if (durationMs <= 60_000) return 5_000;
  if (durationMs <= 120_000) return 10_000;
  return 15_000;
}

function buildTickMarks(durationMs: number) {
  const interval = getTickInterval(durationMs);
  const marks: number[] = [];

  for (let current = 0; current <= durationMs; current += interval) {
    marks.push(current);
  }

  if (marks[marks.length - 1] !== durationMs) {
    marks.push(durationMs);
  }

  return marks;
}

function SegmentThumbnailTile({
  videoUrl,
  thumbnailUrl,
  title,
}: {
  videoUrl: string | null;
  thumbnailUrl?: string | null;
  title: string;
}) {
  if (thumbnailUrl) {
    return (
      <div
        className="h-full w-full bg-cover bg-center"
        style={{ backgroundImage: `url("${thumbnailUrl}")` }}
      />
    );
  }

  if (videoUrl) {
    return (
      <VideoThumbnail
        videoUrl={videoUrl}
        thumbnailUrl={thumbnailUrl}
        title={title}
        className="h-full w-full object-cover opacity-80"
        fallbackIconClassName="h-8 w-8 text-white/60"
      />
    );
  }

  return <div className="h-full w-full bg-slate-900" />;
}

export function ShortSegmentsTimelineEditor({
  videoUrl,
  thumbnailUrl,
  segments,
  timelineDurationMs,
  onChange,
  onAddSegment,
  onDeleteSegment,
  error,
}: ShortSegmentsTimelineEditorProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const trackRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const segmentsRef = useRef<ProjectShortSegment[]>(segments);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  const safeTimelineDurationMs = Math.max(MIN_TIMELINE_DURATION_MS, timelineDurationMs);
  const tickMarks = useMemo(
    () => buildTickMarks(safeTimelineDurationMs),
    [safeTimelineDurationMs]
  );

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = dragState.mode === 'move' ? 'grabbing' : 'ew-resize';
    document.body.style.userSelect = 'none';

    const handlePointerMove = (event: PointerEvent) => {
      const deltaX = event.clientX - dragState.startClientX;
      const rawDeltaMs = (deltaX / Math.max(1, dragState.trackWidth)) * safeTimelineDurationMs;
      const deltaMs = roundToIncrement(rawDeltaMs, SNAP_INCREMENT_MS);

      const currentSegments = segmentsRef.current;
      const nextSegments = currentSegments.map((segment, index) => {
        if (index !== dragState.segmentIndex) {
          return segment;
        }

        const segmentDuration = dragState.initialEndMs - dragState.initialStartMs;

        if (dragState.mode === 'move') {
          const nextStart = clamp(
            dragState.initialStartMs + deltaMs,
            0,
            Math.max(0, safeTimelineDurationMs - segmentDuration)
          );
          const snappedStart = clamp(
            roundToIncrement(nextStart, SNAP_INCREMENT_MS),
            0,
            Math.max(0, safeTimelineDurationMs - segmentDuration)
          );

          return {
            ...segment,
            start_ms: snappedStart,
            end_ms: snappedStart + segmentDuration,
          };
        }

        if (dragState.mode === 'resize-start') {
          const nextStart = clamp(
            dragState.initialStartMs + deltaMs,
            0,
            dragState.initialEndMs - MIN_SEGMENT_DURATION_MS
          );
          const snappedStart = clamp(
            roundToIncrement(nextStart, SNAP_INCREMENT_MS),
            0,
            dragState.initialEndMs - MIN_SEGMENT_DURATION_MS
          );

          return {
            ...segment,
            start_ms: snappedStart,
          };
        }

        const nextEnd = clamp(
          dragState.initialEndMs + deltaMs,
          dragState.initialStartMs + MIN_SEGMENT_DURATION_MS,
          safeTimelineDurationMs
        );
        const snappedEnd = clamp(
          roundToIncrement(nextEnd, SNAP_INCREMENT_MS),
          dragState.initialStartMs + MIN_SEGMENT_DURATION_MS,
          safeTimelineDurationMs
        );

        return {
          ...segment,
          end_ms: snappedEnd,
        };
      });

      onChange(nextSegments);
    };

    const handlePointerUp = () => {
      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, onChange, safeTimelineDurationMs]);

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>, segmentIndex: number, mode: DragMode) => {
    const trackElement = trackRefs.current[segmentIndex];
    const segment = segments[segmentIndex];

    if (!trackElement || !segment) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    setDragState({
      segmentIndex,
      mode,
      startClientX: event.clientX,
      initialStartMs: segment.start_ms,
      initialEndMs: segment.end_ms,
      trackWidth: Math.max(1, trackElement.getBoundingClientRect().width),
    });
  };

  const handleFieldChange = (segmentIndex: number, field: 'start_ms' | 'end_ms', rawValue: string) => {
    const parsedValue = Number.parseInt(rawValue, 10);

    onChange(
      segments.map((segment, index) => {
        if (index !== segmentIndex) {
          return segment;
        }

        const nextValue = Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : 0;

        if (field === 'start_ms') {
          return {
            ...segment,
            start_ms: Math.min(nextValue, Math.max(0, segment.end_ms - MIN_SEGMENT_DURATION_MS)),
          };
        }

        return {
          ...segment,
          end_ms: Math.max(nextValue, segment.start_ms + MIN_SEGMENT_DURATION_MS),
        };
      })
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Short Segments</h2>
          <p className="mt-1 text-sm text-slate-400">
            Drag each segment across the short timeline, or resize from the left and right edges to fine-tune the clip range.
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={onAddSegment}>
          <Plus className="h-4 w-4" />
          Add Segment
        </Button>
      </div>

      {segments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 px-6 py-10 text-center">
          <p className="text-sm font-medium text-white">No segments found</p>
          <p className="mt-2 text-sm text-slate-400">
            This short does not currently include editable segment timing data.
          </p>
          <div className="mt-5">
            <Button variant="secondary" size="sm" onClick={onAddSegment}>
              <Plus className="h-4 w-4" />
              Add First Segment
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {segments.map((segment, index) => {
            const leftPercentage = clamp((segment.start_ms / safeTimelineDurationMs) * 100, 0, 100);
            const widthPercentage = clamp(
              ((segment.end_ms - segment.start_ms) / safeTimelineDurationMs) * 100,
              0,
              100
            );

            return (
              <Card key={`segment-${index}`} className="border-slate-800 bg-slate-950/40">
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                        <Scissors className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Segment {index + 1}</p>
                        <p className="text-xs text-slate-400">
                          {formatTimelineTime(segment.start_ms)} to {formatTimelineTime(segment.end_ms)}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-300">
                      Duration {formatTimelineTime(segment.end_ms - segment.start_ms)}
                    </div>
                  </div>

                  <div className="space-y-3 overflow-hidden">
                    <div className="relative h-10 overflow-hidden rounded-xl border border-slate-700 bg-slate-900/90">
                      {tickMarks.map((tick, tickIndex) => {
                        const left = clamp((tick / safeTimelineDurationMs) * 100, 0, 100);
                        const isFirst = tickIndex === 0;
                        const isLast = tickIndex === tickMarks.length - 1;

                        return (
                          <div
                            key={`tick-${index}-${tick}`}
                            className="absolute inset-y-0"
                            style={{ left: `${left}%` }}
                          >
                            <div className="absolute inset-y-0 w-px bg-slate-700/90" />
                            <span
                              className={`absolute top-2 whitespace-nowrap text-xs text-slate-400 ${
                                isFirst
                                  ? 'translate-x-0 pl-2'
                                  : isLast
                                    ? '-translate-x-full -ml-2'
                                    : '-translate-x-1/2'
                              }`}
                            >
                              {formatTimelineTime(tick)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div
                      ref={(element) => {
                        trackRefs.current[index] = element;
                      }}
                      className="relative h-28 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/70"
                    >
                      <div className="absolute inset-0 flex">
                        {Array.from({ length: THUMBNAIL_TILE_COUNT }).map((_, tileIndex) => (
                          <div
                            key={`segment-strip-${index}-${tileIndex}`}
                            className="relative h-full flex-1 overflow-hidden border-r border-slate-700/60 bg-slate-950"
                          >
                            <SegmentThumbnailTile
                              videoUrl={videoUrl}
                              thumbnailUrl={thumbnailUrl}
                              title={`Segment ${index + 1} thumbnail ${tileIndex + 1}`}
                            />
                            <div className="absolute inset-0 bg-slate-950/20" />
                          </div>
                        ))}
                      </div>

                      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-transparent to-slate-950/35" />

                      <div
                        className="absolute inset-y-2 rounded-xl border-2 border-cyan-400 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]"
                        style={{
                          left: `${leftPercentage}%`,
                          width: `${Math.max(widthPercentage, 1)}%`,
                        }}
                      >
                        <div
                          role="presentation"
                          className="relative flex h-full cursor-grab items-center justify-between overflow-hidden rounded-[10px] active:cursor-grabbing"
                          onPointerDown={(event) => startDrag(event, index, 'move')}
                        >
                          <div
                            role="presentation"
                            className="absolute inset-y-0 left-0 z-10 flex w-5 cursor-ew-resize items-center justify-center bg-cyan-400/20 transition-colors hover:bg-cyan-400/30"
                            onPointerDown={(event) => startDrag(event, index, 'resize-start')}
                          >
                            <GripVertical className="h-4 w-4 text-white" />
                          </div>

                          <div className="absolute inset-0 flex items-center justify-between gap-2 px-8 text-xs font-medium text-white">
                            <span className="max-w-[45%] truncate rounded-full bg-slate-950/70 px-2.5 py-1">
                              Segment {index + 1}
                            </span>
                            <span className="hidden rounded-full bg-slate-950/70 px-2.5 py-1 md:inline-block">
                              {formatTimelineTime(segment.start_ms)} - {formatTimelineTime(segment.end_ms)}
                            </span>
                          </div>

                          <div
                            role="presentation"
                            className="absolute inset-y-0 right-0 z-10 flex w-5 cursor-ew-resize items-center justify-center bg-cyan-400/20 transition-colors hover:bg-cyan-400/30"
                            onPointerDown={(event) => startDrag(event, index, 'resize-end')}
                          >
                            <GripVertical className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <Input
                      label="Start (ms)"
                      type="number"
                      min="0"
                      step={SNAP_INCREMENT_MS}
                      value={segment.start_ms}
                      onChange={(event) => handleFieldChange(index, 'start_ms', event.target.value)}
                    />
                    <Input
                      label="End (ms)"
                      type="number"
                      min={segment.start_ms + MIN_SEGMENT_DURATION_MS}
                      step={SNAP_INCREMENT_MS}
                      value={segment.end_ms}
                      onChange={(event) => handleFieldChange(index, 'end_ms', event.target.value)}
                    />
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
                        <Clock3 className="h-4 w-4 text-violet-300" />
                        Segment Summary
                      </div>
                      <div className="space-y-1 text-sm text-slate-400">
                        <p>Start: {formatTimelineTime(segment.start_ms)}</p>
                        <p>End: {formatTimelineTime(segment.end_ms)}</p>
                        <p>Length: {formatTimelineTime(segment.end_ms - segment.start_ms)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button variant="danger" size="sm" onClick={() => onDeleteSegment(index)}>
                      <Trash2 className="h-4 w-4" />
                      Delete Segment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}
