'use client';

import type { CSSProperties } from 'react';
import { Palette, SlidersHorizontal, Type } from 'lucide-react';
import {
  DEFAULT_PROJECT_SUBTITLE_CONFIG,
  ProjectSubtitleConfig,
  SubtitleConfigMode,
} from '@/lib/project-editing';

interface SubtitleConfigEditorProps {
  mode: SubtitleConfigMode;
  value: ProjectSubtitleConfig;
  onModeChange: (mode: SubtitleConfigMode) => void;
  onChange: (value: ProjectSubtitleConfig) => void;
}

const fontWeightOptions = [400, 500, 600, 700, 800, 900];
const fontStyleOptions = ['normal', 'italic', 'oblique'];
const textTransformOptions = ['uppercase', 'capitalize', 'none', 'lowercase'];
const verticalAlignOptions = ['top', 'center', 'bottom'];
const displayModeOptions = ['word_by_word', 'chunked', 'line_by_line'];

function inputClassName() {
  return 'w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-sm text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500';
}

function sectionTitle(label: string, description: string) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-white">{label}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function RangeField({
  label,
  min,
  max,
  step = 1,
  value,
  suffix = '',
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-300">
        {label} ({value}
        {suffix})
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-300">{label}</label>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-900 p-1"
      />
    </div>
  );
}

function getPreviewJustifyClass(verticalAlign: string) {
  switch (verticalAlign) {
    case 'top':
      return 'justify-start';
    case 'center':
      return 'justify-center';
    default:
      return 'justify-end';
  }
}

export function SubtitleConfigEditor({
  mode,
  value,
  onModeChange,
  onChange,
}: SubtitleConfigEditorProps) {
  const updateValue = (nextValue: ProjectSubtitleConfig) => {
    onChange(nextValue);
  };

  const resetToPreset = () => {
    updateValue(DEFAULT_PROJECT_SUBTITLE_CONFIG);
  };

  const sampleWords = ['MAKE', 'YOUR', 'VIDEOS', 'POP'];
  const activeWordCount = Math.max(1, Math.min(sampleWords.length, value.structure.maxWords));
  const activeWords = sampleWords.slice(0, activeWordCount).join(' ');
  const inactiveWords = sampleWords.slice(activeWordCount).join(' ');

  const previewTextStyle: CSSProperties = {
    fontFamily: value.font.family,
    fontWeight: value.font.weight,
    fontStyle: value.font.style as CSSProperties['fontStyle'],
    textTransform: value.font.transform as CSSProperties['textTransform'],
    lineHeight: value.font.lineHeight,
    letterSpacing: value.font.letterSpacing,
  };

  const activePreviewStyle = {
    ...previewTextStyle,
    fontSize: `${Math.max(26, Math.round(value.font.size * 0.42))}px`,
    backgroundImage: `linear-gradient(135deg, ${value.colors.active[0]}, ${value.colors.active[1]})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    WebkitTextStroke: `${Math.max(0, value.decoration.strokeWidth * 0.45)}px ${value.decoration.strokeColor}`,
    textShadow: `${Math.max(0, value.decoration.shadowOffset * 0.18)}px ${Math.max(0, value.decoration.shadowOffset * 0.18)}px ${Math.max(0, value.animation.blurIntensity * 0.2)}px ${value.decoration.shadowColor}`,
    transform: `scale(${1 + value.animation.scaleEntry * 0.15}) rotate(${value.animation.rotateRange * 0.15}deg)`,
  } as CSSProperties;

  const inactivePreviewStyle = {
    ...previewTextStyle,
    color: value.colors.inactive,
    fontSize: `${Math.max(20, Math.round(value.font.size * 0.28))}px`,
    WebkitTextStroke: `${Math.max(0, value.decoration.strokeWidth * 0.2)}px ${value.decoration.strokeColor}`,
    textShadow: `${Math.max(0, value.decoration.shadowOffset * 0.12)}px ${Math.max(0, value.decoration.shadowOffset * 0.12)}px ${Math.max(0, value.animation.blurIntensity * 0.15)}px ${value.decoration.shadowColor}`,
  } as CSSProperties;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Type className="h-4 w-4 text-violet-300" />
            <label className="text-sm font-medium text-slate-300">Subtitle Configuration</label>
          </div>
          <p className="text-sm text-slate-500">
            Customize the subtitle override with structured controls instead of editing raw JSON.
          </p>
        </div>

        <button
          type="button"
          onClick={resetToPreset}
          className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
        >
          Reset Preset
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onModeChange('default')}
          className={`rounded-2xl border-2 p-4 text-left transition-all ${
            mode === 'default'
              ? 'border-violet-500 bg-violet-500/10'
              : 'border-slate-700 bg-slate-900/40 hover:border-violet-400/40'
          }`}
        >
          <p className="font-semibold text-white">Use Project Default</p>
          <p className="mt-1 text-sm text-slate-400">
            Send `null` for `subtitle_config_override` and keep the backend default subtitle look.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onModeChange('custom')}
          className={`rounded-2xl border-2 p-4 text-left transition-all ${
            mode === 'custom'
              ? 'border-violet-500 bg-violet-500/10'
              : 'border-slate-700 bg-slate-900/40 hover:border-violet-400/40'
          }`}
        >
          <p className="font-semibold text-white">Customize Override</p>
          <p className="mt-1 text-sm text-slate-400">
            Send a full subtitle configuration object with typography, colors, motion, and decoration.
          </p>
        </button>
      </div>

      {mode === 'custom' ? (
        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              {sectionTitle('Typography', 'Control the font stack, scale, casing, and spacing.')}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Font Family</label>
                  <input
                    type="text"
                    value={value.font.family}
                    onChange={(event) =>
                      updateValue({
                        ...value,
                        font: {
                          ...value.font,
                          family: event.target.value,
                        },
                      })
                    }
                    className={inputClassName()}
                    placeholder='"Archivo Black", "Impact", sans-serif'
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Weight</label>
                  <select
                    value={String(value.font.weight)}
                    onChange={(event) =>
                      updateValue({
                        ...value,
                        font: {
                          ...value.font,
                          weight: Number(event.target.value),
                        },
                      })
                    }
                    className={inputClassName()}
                  >
                    {fontWeightOptions.map((weight) => (
                      <option key={weight} value={weight}>
                        {weight}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Font Style</label>
                  <select
                    value={value.font.style}
                    onChange={(event) =>
                      updateValue({
                        ...value,
                        font: {
                          ...value.font,
                          style: event.target.value,
                        },
                      })
                    }
                    className={inputClassName()}
                  >
                    {fontStyleOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Text Transform</label>
                  <select
                    value={value.font.transform}
                    onChange={(event) =>
                      updateValue({
                        ...value,
                        font: {
                          ...value.font,
                          transform: event.target.value,
                        },
                      })
                    }
                    className={inputClassName()}
                  >
                    {textTransformOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Letter Spacing</label>
                  <input
                    type="text"
                    value={value.font.letterSpacing}
                    onChange={(event) =>
                      updateValue({
                        ...value,
                        font: {
                          ...value.font,
                          letterSpacing: event.target.value,
                        },
                      })
                    }
                    className={inputClassName()}
                    placeholder="-2px"
                  />
                </div>

                <RangeField
                  label="Font Size"
                  min={32}
                  max={140}
                  value={value.font.size}
                  suffix="px"
                  onChange={(nextValue) =>
                    updateValue({
                      ...value,
                      font: {
                        ...value.font,
                        size: nextValue,
                      },
                    })
                  }
                />

                <RangeField
                  label="Line Height"
                  min={0.8}
                  max={1.8}
                  step={0.05}
                  value={value.font.lineHeight}
                  onChange={(nextValue) =>
                    updateValue({
                      ...value,
                      font: {
                        ...value.font,
                        lineHeight: nextValue,
                      },
                    })
                  }
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Palette className="h-4 w-4 text-cyan-300" />
                <div>
                  <h3 className="text-sm font-semibold text-white">Colors & Structure</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Manage active/inactive word colors and how captions are chunked on screen.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <ColorField
                  label="Active Color 1"
                  value={value.colors.active[0]}
                  onChange={(nextValue) =>
                    updateValue({
                      ...value,
                      colors: {
                        ...value.colors,
                        active: [nextValue, value.colors.active[1]],
                      },
                    })
                  }
                />

                <ColorField
                  label="Active Color 2"
                  value={value.colors.active[1]}
                  onChange={(nextValue) =>
                    updateValue({
                      ...value,
                      colors: {
                        ...value.colors,
                        active: [value.colors.active[0], nextValue],
                      },
                    })
                  }
                />

                <ColorField
                  label="Inactive Color"
                  value={value.colors.inactive}
                  onChange={(nextValue) =>
                    updateValue({
                      ...value,
                      colors: {
                        ...value.colors,
                        inactive: nextValue,
                      },
                    })
                  }
                />

                <RangeField
                  label="Max Words"
                  min={1}
                  max={6}
                  value={value.structure.maxWords}
                  onChange={(nextValue) =>
                    updateValue({
                      ...value,
                      structure: {
                        ...value.structure,
                        maxWords: nextValue,
                      },
                    })
                  }
                />

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Display Mode</label>
                  <select
                    value={value.structure.displayMode}
                    onChange={(event) =>
                      updateValue({
                        ...value,
                        structure: {
                          ...value.structure,
                          displayMode: event.target.value,
                        },
                      })
                    }
                    className={inputClassName()}
                  >
                    {displayModeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Vertical Align</label>
                  <select
                    value={value.structure.verticalAlign}
                    onChange={(event) =>
                      updateValue({
                        ...value,
                        structure: {
                          ...value.structure,
                          verticalAlign: event.target.value,
                        },
                      })
                    }
                    className={inputClassName()}
                  >
                    {verticalAlignOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <div className="mb-4 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-emerald-300" />
                <div>
                  <h3 className="text-sm font-semibold text-white">Decoration & Animation</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Tune stroke, shadow, blur, scale entry, rotation, and shake behavior.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <ColorField
                  label="Stroke Color"
                  value={value.decoration.strokeColor}
                  onChange={(nextValue) =>
                    updateValue({
                      ...value,
                      decoration: {
                        ...value.decoration,
                        strokeColor: nextValue,
                      },
                    })
                  }
                />

                <ColorField
                  label="Shadow Color"
                  value={value.decoration.shadowColor}
                  onChange={(nextValue) =>
                    updateValue({
                      ...value,
                      decoration: {
                        ...value.decoration,
                        shadowColor: nextValue,
                      },
                    })
                  }
                />

                <RangeField
                  label="Stroke Width"
                  min={0}
                  max={10}
                  value={value.decoration.strokeWidth}
                  suffix="px"
                  onChange={(nextValue) =>
                    updateValue({
                      ...value,
                      decoration: {
                        ...value.decoration,
                        strokeWidth: nextValue,
                      },
                    })
                  }
                />

                <RangeField
                  label="Shadow Offset"
                  min={0}
                  max={20}
                  value={value.decoration.shadowOffset}
                  suffix="px"
                  onChange={(nextValue) =>
                    updateValue({
                      ...value,
                      decoration: {
                        ...value.decoration,
                        shadowOffset: nextValue,
                      },
                    })
                  }
                />

                <RangeField
                  label="Scale Entry"
                  min={0}
                  max={1}
                  step={0.05}
                  value={value.animation.scaleEntry}
                  onChange={(nextValue) =>
                    updateValue({
                      ...value,
                      animation: {
                        ...value.animation,
                        scaleEntry: nextValue,
                      },
                    })
                  }
                />

                <RangeField
                  label="Rotate Range"
                  min={0}
                  max={15}
                  value={value.animation.rotateRange}
                  suffix="deg"
                  onChange={(nextValue) =>
                    updateValue({
                      ...value,
                      animation: {
                        ...value.animation,
                        rotateRange: nextValue,
                      },
                    })
                  }
                />

                <RangeField
                  label="Blur Intensity"
                  min={0}
                  max={12}
                  value={value.animation.blurIntensity}
                  suffix="px"
                  onChange={(nextValue) =>
                    updateValue({
                      ...value,
                      animation: {
                        ...value.animation,
                        blurIntensity: nextValue,
                      },
                    })
                  }
                />

                <RangeField
                  label="Shake Intensity"
                  min={0}
                  max={10}
                  value={value.animation.shakeIntensity}
                  onChange={(nextValue) =>
                    updateValue({
                      ...value,
                      animation: {
                        ...value.animation,
                        shakeIntensity: nextValue,
                      },
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <h3 className="text-sm font-semibold text-white">Preview</h3>
              <p className="mt-1 text-sm text-slate-500">
                A simplified preview of the current caption configuration.
              </p>

              <div
                className={`mt-4 flex h-[320px] rounded-2xl border border-slate-700 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.18),_transparent_45%),linear-gradient(180deg,_rgba(15,23,42,0.82),_rgba(2,6,23,1))] p-5 ${getPreviewJustifyClass(value.structure.verticalAlign)}`}
              >
                <div className="w-full">
                  <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-400">
                    <span className="rounded-full bg-slate-800 px-2.5 py-1">
                      {value.structure.displayMode}
                    </span>
                    <span className="rounded-full bg-slate-800 px-2.5 py-1">
                      max {value.structure.maxWords} word{value.structure.maxWords > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <p style={activePreviewStyle}>{activeWords}</p>
                    {inactiveWords && <p style={inactivePreviewStyle}>{inactiveWords}</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <h3 className="text-sm font-semibold text-white">API Shape</h3>
              <p className="mt-1 text-sm text-slate-500">
                This editor sends a nested `subtitle_config_override` object with `font`, `colors`,
                `animation`, `structure`, and `decoration`.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/20 p-5 text-sm text-slate-400">
          Default subtitle rendering is active. Switch to `Customize Override` to send a full subtitle
          configuration object in the API payload.
        </div>
      )}
    </div>
  );
}
