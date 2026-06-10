'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Copy,
  Image as ImageIcon,
  Mic,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  Trash2,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Toast } from '@/components/ui/Toast';
import { AssetPickerModal } from '@/components/assets/AssetPickerModal';
import { api, assetsApi, getApiErrorMessage, personasApi } from '@/lib/api';
import { LibraryAsset } from '@/lib/library-assets';
import {
  AssetGenerationJobResponse,
  AssetItem,
  ElevenLabsVoice,
  Persona,
  PersonaPayload,
} from '@/types';

type ToastState = {
  open: boolean;
  title?: string;
  message: string;
  variant: 'error' | 'success' | 'info';
};

type PortraitAspect = '9:16' | '1:1';

type AssetPickerTarget = 'portrait' | 'reference' | null;

const selectClassName =
  'block h-11 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-white transition-all duration-200 ease-out focus:border-violet-500/60 focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50';

interface ReferenceImage {
  id: string;
  previewUrl: string | null;
}

interface PersonaFormState {
  name: string;
  personality: string;
  appearancePrompt: string;
  voiceId: string;
  portraitAssetId: string | null;
  portraitPreviewUrl: string | null;
  referenceImages: ReferenceImage[];
}

const EMPTY_FORM: PersonaFormState = {
  name: '',
  personality: '',
  appearancePrompt: '',
  voiceId: '',
  portraitAssetId: null,
  portraitPreviewUrl: null,
  referenceImages: [],
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function libraryAssetToAssetItem(asset: LibraryAsset): AssetItem {
  return {
    id: asset.id,
    title: asset.title,
    asset_type: asset.type,
    source_type: asset.source === 'ai_generated' ? 'generated' : 'uploaded',
    status: 'ready',
    url: asset.url,
    thumbnail_url: asset.thumbnailUrl || null,
  };
}

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [totalPersonas, setTotalPersonas] = useState(0);
  const [loadingPersonas, setLoadingPersonas] = useState(true);
  const [refreshingPersonas, setRefreshingPersonas] = useState(false);
  const [assetCache, setAssetCache] = useState<Record<string, AssetItem | null>>({});

  // ElevenLabs voices (used for the voice select and the card chips)
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const voicePreviewRef = useRef<HTMLAudioElement | null>(null);

  // Create / Edit Modal State
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [form, setForm] = useState<PersonaFormState>(EMPTY_FORM);
  const [savingPersona, setSavingPersona] = useState(false);
  const [assetPickerTarget, setAssetPickerTarget] = useState<AssetPickerTarget>(null);

  // Portrait generation state
  const [portraitAspect, setPortraitAspect] = useState<PortraitAspect>('9:16');
  const [generatingPortrait, setGeneratingPortrait] = useState(false);
  const [pollingPortrait, setPollingPortrait] = useState(false);
  const [portraitJob, setPortraitJob] = useState<AssetGenerationJobResponse | null>(null);
  const [generatedPortrait, setGeneratedPortrait] = useState<AssetItem | null>(null);
  const [portraitError, setPortraitError] = useState<string | null>(null);

  // Delete State
  const [personaToDelete, setPersonaToDelete] = useState<Persona | null>(null);
  const [deletingPersonaId, setDeletingPersonaId] = useState<string | null>(null);

  // Clone State (for preset / featured personas)
  const [cloningPersonaId, setCloningPersonaId] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: '',
    variant: 'info',
  });
  const toastTimeoutRef = useRef<number | null>(null);

  const isPortraitBusy = generatingPortrait || pollingPortrait;

  const showToast = useCallback((message: string, variant: ToastState['variant'], title?: string) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    setToast({
      open: true,
      title,
      message,
      variant,
    });

    toastTimeoutRef.current = window.setTimeout(() => {
      setToast((currentToast) => ({ ...currentToast, open: false }));
      toastTimeoutRef.current = null;
    }, 5000);
  }, []);

  const closeToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }

    setToast((currentToast) => ({ ...currentToast, open: false }));
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const stopVoicePreview = useCallback(() => {
    if (voicePreviewRef.current) {
      voicePreviewRef.current.pause();
      voicePreviewRef.current = null;
    }
    setPreviewingVoiceId(null);
  }, []);

  useEffect(() => {
    return () => {
      if (voicePreviewRef.current) {
        voicePreviewRef.current.pause();
        voicePreviewRef.current = null;
      }
    };
  }, []);

  const loadPersonas = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') {
      setLoadingPersonas(true);
    } else {
      setRefreshingPersonas(true);
    }

    try {
      const data = await personasApi.list();
      setPersonas(data.items);
      setTotalPersonas(data.total);
    } catch (error) {
      console.error('Failed to load personas:', error);
      showToast(getApiErrorMessage(error, 'Failed to load personas.'), 'error', 'Load Failed');
    } finally {
      setLoadingPersonas(false);
      setRefreshingPersonas(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadPersonas();
  }, [loadPersonas]);

  const loadVoices = useCallback(async () => {
    setLoadingVoices(true);
    try {
      const response = await assetsApi.listElevenLabsVoices({ page_size: 100 });
      setVoices(response.items);
    } catch (error) {
      console.error('Failed to load ElevenLabs voices:', error);
      showToast(getApiErrorMessage(error, 'Failed to load voices.'), 'error', 'Voices Unavailable');
    } finally {
      setLoadingVoices(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadVoices();
  }, [loadVoices]);

  useEffect(() => {
    const missingAssetIds = Array.from(
      new Set(
        personas.flatMap((persona) => [
          ...(persona.portrait_asset_id ? [persona.portrait_asset_id] : []),
          ...persona.reference_asset_ids,
        ])
      )
    ).filter((assetId) => !(assetId in assetCache));

    if (missingAssetIds.length === 0) {
      return;
    }

    let cancelled = false;

    const fetchAssets = async () => {
      const entries = await Promise.all(
        missingAssetIds.map(async (assetId) => {
          try {
            const res = await api.get(`/api/assets/${assetId}`);
            return [assetId, res.data as AssetItem] as const;
          } catch (error) {
            console.error('Failed to load persona asset:', error);
            return [assetId, null] as const;
          }
        })
      );

      if (!cancelled) {
        setAssetCache((currentCache) => ({
          ...currentCache,
          ...Object.fromEntries(entries),
        }));
      }
    };

    void fetchAssets();

    return () => {
      cancelled = true;
    };
  }, [personas, assetCache]);

  useEffect(() => {
    // Handle body overflow for the persona modal
    const previousOverflow = document.body.style.overflow;
    if (showPersonaModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = previousOverflow;
    }
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showPersonaModal]);

  const getAssetPreviewUrl = useCallback((assetId: string | null) => {
    if (!assetId) {
      return null;
    }

    const asset = assetCache[assetId];
    return asset?.thumbnail_url || asset?.url || null;
  }, [assetCache]);

  const getVoiceName = useCallback((voiceId: string | null) => {
    if (!voiceId) {
      return null;
    }

    return voices.find((voice) => voice.voice_id === voiceId)?.name || 'Custom voice';
  }, [voices]);

  const resetPortraitGeneration = useCallback(() => {
    setPortraitAspect('9:16');
    setGeneratingPortrait(false);
    setPollingPortrait(false);
    setPortraitJob(null);
    setGeneratedPortrait(null);
    setPortraitError(null);
  }, []);

  const handleOpenCreateModal = () => {
    setEditingPersona(null);
    setForm(EMPTY_FORM);
    resetPortraitGeneration();
    setShowPersonaModal(true);
  };

  const handleOpenEditModal = (persona: Persona) => {
    setEditingPersona(persona);
    setForm({
      name: persona.name,
      personality: persona.personality || '',
      appearancePrompt: persona.appearance_prompt || '',
      voiceId: persona.voice_id || '',
      portraitAssetId: persona.portrait_asset_id,
      portraitPreviewUrl: getAssetPreviewUrl(persona.portrait_asset_id),
      referenceImages: persona.reference_asset_ids.map((assetId) => ({
        id: assetId,
        previewUrl: getAssetPreviewUrl(assetId),
      })),
    });
    resetPortraitGeneration();
    setShowPersonaModal(true);
  };

  const handleClosePersonaModal = () => {
    if (savingPersona) {
      return;
    }

    setShowPersonaModal(false);
    setAssetPickerTarget(null);
    setEditingPersona(null);
    setForm(EMPTY_FORM);
    resetPortraitGeneration();
    stopVoicePreview();
  };

  const canSavePersona = !savingPersona && form.name.trim().length > 0;

  const handleSavePersona = async () => {
    if (!canSavePersona) {
      return;
    }

    const payload: PersonaPayload = {
      name: form.name.trim(),
      personality: form.personality.trim() || null,
      appearance_prompt: form.appearancePrompt.trim() || null,
      portrait_asset_id: form.portraitAssetId,
      reference_asset_ids: form.referenceImages.map((image) => image.id),
      voice_id: form.voiceId || null,
    };

    setSavingPersona(true);
    try {
      if (editingPersona) {
        const updatedPersona = await personasApi.update(editingPersona.id, payload);
        setPersonas((currentPersonas) =>
          currentPersonas.map((persona) => (persona.id === updatedPersona.id ? updatedPersona : persona))
        );
        showToast(`"${updatedPersona.name}" has been updated.`, 'success', 'Persona Saved');
      } else {
        const createdPersona = await personasApi.create(payload);
        setPersonas((currentPersonas) => [createdPersona, ...currentPersonas]);
        setTotalPersonas((currentTotal) => currentTotal + 1);
        showToast(`"${createdPersona.name}" is ready to star in your ads.`, 'success', 'Persona Created');
      }

      setShowPersonaModal(false);
      setAssetPickerTarget(null);
      setEditingPersona(null);
      setForm(EMPTY_FORM);
      resetPortraitGeneration();
      stopVoicePreview();
    } catch (error) {
      console.error('Failed to save persona:', error);
      showToast(getApiErrorMessage(error, 'Failed to save persona.'), 'error', 'Save Failed');
    } finally {
      setSavingPersona(false);
    }
  };

  const handleDeletePersona = async () => {
    if (!personaToDelete) {
      return;
    }

    setDeletingPersonaId(personaToDelete.id);
    try {
      await personasApi.remove(personaToDelete.id);
      setPersonas((currentPersonas) => currentPersonas.filter((persona) => persona.id !== personaToDelete.id));
      setTotalPersonas((currentTotal) => Math.max(0, currentTotal - 1));
      showToast(`"${personaToDelete.name}" has been deleted.`, 'success', 'Persona Deleted');
      setPersonaToDelete(null);
    } catch (error) {
      console.error('Failed to delete persona:', error);
      showToast(getApiErrorMessage(error, 'Failed to delete persona.'), 'error', 'Delete Failed');
    } finally {
      setDeletingPersonaId(null);
    }
  };

  const handleClonePersona = async (persona: Persona) => {
    if (cloningPersonaId) {
      return;
    }

    setCloningPersonaId(persona.id);
    try {
      const clonedPersona = await personasApi.clone(persona.id);
      setPersonas((currentPersonas) => [clonedPersona, ...currentPersonas]);
      setTotalPersonas((currentTotal) => currentTotal + 1);
      showToast(`"${clonedPersona.name}" was added to your personas.`, 'success', 'Added to Your Personas');
    } catch (error) {
      console.error('Failed to clone persona:', error);
      showToast(getApiErrorMessage(error, 'Failed to add this persona.'), 'error', 'Clone Failed');
    } finally {
      setCloningPersonaId(null);
    }
  };

  const handleToggleVoicePreview = (voice: ElevenLabsVoice) => {
    if (!voice.preview_url) {
      return;
    }

    if (previewingVoiceId === voice.voice_id) {
      stopVoicePreview();
      return;
    }

    stopVoicePreview();

    const audio = new Audio(voice.preview_url);
    voicePreviewRef.current = audio;
    setPreviewingVoiceId(voice.voice_id);

    audio.onended = () => {
      voicePreviewRef.current = null;
      setPreviewingVoiceId(null);
    };

    void audio.play().catch((error) => {
      console.error('Failed to play voice preview:', error);
      voicePreviewRef.current = null;
      setPreviewingVoiceId(null);
      showToast('Could not play the voice preview.', 'error', 'Preview Failed');
    });
  };

  const handleGeneratePortrait = async () => {
    const appearancePrompt = form.appearancePrompt.trim();
    if (!appearancePrompt || isPortraitBusy) {
      return;
    }

    setGeneratingPortrait(true);
    setPortraitError(null);
    setGeneratedPortrait(null);

    try {
      const response = await assetsApi.generate({
        asset_type: 'image',
        title: `${form.name.trim() || 'Persona'} portrait`,
        prompt: appearancePrompt,
        aspect_ratio: portraitAspect,
        reference_image_asset_ids:
          form.referenceImages.length > 0
            ? form.referenceImages.map((image) => image.id)
            : undefined,
      });

      if (response.asset) {
        const asset = response.asset;
        setAssetCache((currentCache) => ({ ...currentCache, [asset.id]: asset }));
        setGeneratedPortrait(asset);
      } else {
        setPortraitJob(response);

        if (response.job_id) {
          setPollingPortrait(true);
        } else {
          setPortraitError('Generation started, but the backend did not return polling details.');
        }
      }
    } catch (error) {
      console.error('Failed to generate persona portrait:', error);
      setPortraitError(getApiErrorMessage(error, 'Failed to generate portrait.'));
    } finally {
      setGeneratingPortrait(false);
    }
  };

  useEffect(() => {
    const jobId = portraitJob?.job_id;
    const pollUrl = portraitJob?.poll_url || undefined;

    if (!jobId || !pollingPortrait) {
      return;
    }

    let cancelled = false;

    const pollPortraitJob = async () => {
      try {
        const result = await assetsApi.pollGenerationJob(jobId, pollUrl);

        if (cancelled) {
          return;
        }

        setPortraitJob(result);

        const asset = result.asset;
        if (asset) {
          setAssetCache((currentCache) => ({ ...currentCache, [asset.id]: asset }));
          setGeneratedPortrait(asset);
          setPollingPortrait(false);
          setPortraitJob(null);
          setPortraitError(null);
          return;
        }

        if (result.status === 'failed') {
          setPollingPortrait(false);
          setPortraitError(result.error || 'Portrait generation failed.');
          return;
        }

        window.setTimeout(() => {
          if (!cancelled) {
            void pollPortraitJob();
          }
        }, 1500);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to poll portrait generation job:', error);
          setPollingPortrait(false);
          setPortraitError(getApiErrorMessage(error, 'Failed to poll portrait generation progress.'));
        }
      }
    };

    void pollPortraitJob();

    return () => {
      cancelled = true;
    };
  }, [portraitJob?.job_id, portraitJob?.poll_url, pollingPortrait]);

  const handleUseGeneratedPortrait = () => {
    if (!generatedPortrait) {
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,
      portraitAssetId: generatedPortrait.id,
      portraitPreviewUrl: generatedPortrait.thumbnail_url || generatedPortrait.url,
    }));
    setGeneratedPortrait(null);
    showToast('Generated image set as the portrait. Save the persona to keep it.', 'success', 'Portrait Updated');
  };

  const handlePickAsset = (asset: LibraryAsset) => {
    setAssetCache((currentCache) =>
      currentCache[asset.id] ? currentCache : { ...currentCache, [asset.id]: libraryAssetToAssetItem(asset) }
    );

    if (assetPickerTarget === 'portrait') {
      setForm((currentForm) => ({
        ...currentForm,
        portraitAssetId: asset.id,
        portraitPreviewUrl: asset.thumbnailUrl || asset.url,
      }));
      return;
    }

    if (assetPickerTarget === 'reference') {
      setForm((currentForm) => {
        if (currentForm.referenceImages.some((image) => image.id === asset.id)) {
          return currentForm;
        }

        return {
          ...currentForm,
          referenceImages: [
            ...currentForm.referenceImages,
            { id: asset.id, previewUrl: asset.thumbnailUrl || asset.url },
          ],
        };
      });
    }
  };

  const selectedFormVoice = form.voiceId
    ? voices.find((voice) => voice.voice_id === form.voiceId) || null
    : null;
  const hasUnknownFormVoice = !!form.voiceId && !selectedFormVoice;

  const presetPersonas = personas.filter((persona) => persona.is_preset);
  const ownPersonas = personas.filter((persona) => !persona.is_preset);

  const renderPersonaCard = (persona: Persona) => {
    const portraitUrl = getAssetPreviewUrl(persona.portrait_asset_id);
    const voiceName = getVoiceName(persona.voice_id);
    const isPreset = persona.is_preset;
    const isCloning = cloningPersonaId === persona.id;

    return (
      <Card key={persona.id} hover className="group overflow-hidden border-slate-800/80 bg-slate-950/60">
        {/* Portrait */}
        <div className="relative h-64 overflow-hidden bg-slate-900">
          {portraitUrl ? (
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              style={{ backgroundImage: `url("${portraitUrl}")` }}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-violet-500/15 via-slate-900 to-indigo-600/15 text-slate-500">
              <UserCircle className="h-12 w-12" />
              <span className="text-[11px] font-medium uppercase tracking-[0.2em]">No portrait yet</span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0b0b0f] via-[#0b0b0f]/40 to-transparent" />

          {isPreset ? (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-200 backdrop-blur-sm">
              <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
              Featured
            </span>
          ) : (
            <div className="absolute right-3 top-3 flex gap-2">
              <button
                type="button"
                onClick={() => handleOpenEditModal(persona)}
                className="rounded-full border border-white/10 bg-slate-950/70 p-2 text-slate-200 transition-colors hover:bg-slate-900 hover:text-white"
                aria-label={`Edit ${persona.name}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPersonaToDelete(persona)}
                className="rounded-full border border-white/10 bg-slate-950/70 p-2 text-slate-200 transition-colors hover:bg-red-500/20 hover:text-red-300"
                aria-label={`Delete ${persona.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 truncate text-lg font-semibold text-white">{persona.name}</h3>
            {voiceName && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/15 px-2.5 py-0.5 text-xs font-medium text-violet-200">
                <Mic className="h-3 w-3" />
                <span className="max-w-28 truncate">{voiceName}</span>
              </span>
            )}
          </div>

          {persona.personality ? (
            <p className="mt-2 line-clamp-2 text-sm text-slate-400">{persona.personality}</p>
          ) : (
            <p className="mt-2 text-sm italic text-slate-600">No personality defined yet.</p>
          )}

          {(persona.appearance_prompt || persona.reference_asset_ids.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {persona.appearance_prompt && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-xs text-slate-300">
                  <Sparkles className="h-3.5 w-3.5 text-slate-500" />
                  Appearance set
                </span>
              )}
              {persona.reference_asset_ids.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-xs text-slate-300">
                  <ImageIcon className="h-3.5 w-3.5 text-slate-500" />
                  {persona.reference_asset_ids.length} reference
                  {persona.reference_asset_ids.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
          )}

          {isPreset ? (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  void handleClonePersona(persona);
                }}
                loading={isCloning}
                disabled={!!cloningPersonaId}
                className="w-full"
              >
                <Copy className="h-4 w-4" />
                {isCloning ? 'Adding…' : 'Use as mine'}
              </Button>
              <p className="mt-2 text-center text-xs text-slate-500">
                Adds an editable copy to your personas.
              </p>
            </div>
          ) : (
            <p className="mt-4 border-t border-white/[0.06] pt-3 text-xs text-slate-500">
              Updated {formatDateTime(persona.updated_at)}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <Toast
        open={toast.open}
        variant={toast.variant}
        title={toast.title}
        message={toast.message}
        onClose={closeToast}
      />

      <ConfirmDialog
        open={!!personaToDelete}
        title="Delete persona?"
        description={
          personaToDelete
            ? `"${personaToDelete.name}" will be permanently removed. Videos already generated with this persona are not affected.`
            : ''
        }
        confirmLabel="Delete Persona"
        loading={deletingPersonaId === personaToDelete?.id}
        onClose={() => {
          if (!deletingPersonaId) {
            setPersonaToDelete(null);
          }
        }}
        onConfirm={() => {
          void handleDeletePersona();
        }}
      />

      <AssetPickerModal
        isOpen={assetPickerTarget !== null}
        onClose={() => setAssetPickerTarget(null)}
        allowedTypes={['image']}
        onSelectAsset={handlePickAsset}
      />

      {/* Create / Edit Persona Modal */}
      {showPersonaModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={handleClosePersonaModal}
        >
          <Card
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden border-slate-700/70 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative border-b border-slate-700/50 p-6">
              <h2 className="text-2xl font-semibold text-white">
                {editingPersona ? 'Edit Persona' : 'New Persona'}
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Give your AI creator a face, a personality, and a voice — then cast them in any ad you generate.
              </p>
              <button
                type="button"
                onClick={handleClosePersonaModal}
                disabled={savingPersona}
                className="absolute right-4 top-4 rounded-full border border-white/10 bg-slate-800/50 p-2 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close persona editor"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <CardContent className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
              <Input
                label="Name *"
                value={form.name}
                onChange={(event) => setForm((currentForm) => ({ ...currentForm, name: event.target.value }))}
                placeholder="e.g. Maya Chen"
                disabled={savingPersona}
              />

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">Personality</label>
                <textarea
                  value={form.personality}
                  onChange={(event) =>
                    setForm((currentForm) => ({ ...currentForm, personality: event.target.value }))
                  }
                  rows={3}
                  disabled={savingPersona}
                  placeholder="How does this creator talk and behave? e.g. Upbeat fitness coach, speaks fast, loves hyping the audience up."
                  className="block w-full rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-white placeholder-slate-500 transition-all duration-200 ease-out focus:border-violet-500/60 focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">Appearance Prompt</label>
                <textarea
                  value={form.appearancePrompt}
                  onChange={(event) =>
                    setForm((currentForm) => ({ ...currentForm, appearancePrompt: event.target.value }))
                  }
                  rows={3}
                  disabled={savingPersona}
                  placeholder="Describe how this persona looks. e.g. Woman in her late 20s, shoulder-length dark hair, warm smile, casual streetwear, soft studio lighting."
                  className="block w-full rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-white placeholder-slate-500 transition-all duration-200 ease-out focus:border-violet-500/60 focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="text-xs text-slate-500">
                  This prompt drives the portrait generator below and keeps the persona looking consistent.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">Voice</label>
                <div className="flex items-center gap-3">
                  <select
                    value={form.voiceId}
                    onChange={(event) =>
                      setForm((currentForm) => ({ ...currentForm, voiceId: event.target.value }))
                    }
                    disabled={savingPersona || loadingVoices}
                    className={selectClassName}
                  >
                    <option value="">{loadingVoices ? 'Loading voices...' : 'No voice'}</option>
                    {hasUnknownFormVoice && (
                      <option value={form.voiceId}>Custom voice ({form.voiceId})</option>
                    )}
                    {voices.map((voice) => (
                      <option key={voice.voice_id} value={voice.voice_id}>
                        {voice.name}
                        {voice.category ? ` — ${voice.category}` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedFormVoice?.preview_url && (
                    <button
                      type="button"
                      onClick={() => handleToggleVoicePreview(selectedFormVoice)}
                      disabled={savingPersona}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-200 transition-colors hover:bg-violet-500/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={
                        previewingVoiceId === selectedFormVoice.voice_id
                          ? `Stop ${selectedFormVoice.name} preview`
                          : `Play ${selectedFormVoice.name} preview`
                      }
                    >
                      {previewingVoiceId === selectedFormVoice.voice_id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  This ElevenLabs voice narrates every ad starring this persona.
                </p>
              </div>

              {/* Reference Images */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">Reference Images</label>
                <div className="flex flex-wrap gap-3">
                  {form.referenceImages.map((image) => (
                    <div
                      key={image.id}
                      className="relative h-20 w-20 overflow-hidden rounded-xl border border-slate-700 bg-slate-950"
                    >
                      {image.previewUrl ? (
                        <div
                          className="h-full w-full bg-cover bg-center"
                          style={{ backgroundImage: `url("${image.previewUrl}")` }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-slate-600" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setForm((currentForm) => ({
                            ...currentForm,
                            referenceImages: currentForm.referenceImages.filter(
                              (referenceImage) => referenceImage.id !== image.id
                            ),
                          }))
                        }
                        disabled={savingPersona}
                        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Remove reference image"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAssetPickerTarget('reference')}
                    disabled={savingPersona}
                    className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 text-slate-500 transition-colors hover:border-violet-500/60 hover:text-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Add reference image"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="text-[10px] font-medium">Add</span>
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Reference photos guide portrait generation so the persona keeps the same face across every shot.
                </p>
              </div>

              {/* Portrait */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">Portrait</label>
                <div className="flex items-start gap-4">
                  <div className="flex h-40 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
                    {form.portraitPreviewUrl ? (
                      <div
                        className="h-full w-full bg-cover bg-center"
                        style={{ backgroundImage: `url("${form.portraitPreviewUrl}")` }}
                      />
                    ) : form.portraitAssetId ? (
                      <ImageIcon className="h-8 w-8 text-slate-500" />
                    ) : (
                      <UserCircle className="h-10 w-10 text-slate-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setAssetPickerTarget('portrait')}
                        disabled={savingPersona}
                      >
                        <ImageIcon className="h-4 w-4" />
                        {form.portraitAssetId ? 'Change Image' : 'Choose Image'}
                      </Button>
                      {form.portraitAssetId && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            setForm((currentForm) => ({
                              ...currentForm,
                              portraitAssetId: null,
                              portraitPreviewUrl: null,
                            }))
                          }
                          disabled={savingPersona}
                        >
                          Remove
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
                        {(['9:16', '1:1'] as PortraitAspect[]).map((aspect) => (
                          <button
                            key={aspect}
                            type="button"
                            onClick={() => setPortraitAspect(aspect)}
                            disabled={savingPersona || isPortraitBusy}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                              portraitAspect === aspect
                                ? 'bg-violet-500/20 text-violet-200'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {aspect}
                          </button>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          void handleGeneratePortrait();
                        }}
                        loading={isPortraitBusy}
                        disabled={!form.appearancePrompt.trim() || isPortraitBusy || savingPersona}
                      >
                        <Sparkles className="h-4 w-4" />
                        {generatingPortrait
                          ? 'Starting...'
                          : pollingPortrait
                            ? 'Generating...'
                            : 'Generate Portrait'}
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">
                      Generates a portrait from the appearance prompt
                      {form.referenceImages.length > 0 ? ' using your reference images' : ''}. You can also pick
                      any image from your library.
                    </p>
                  </div>
                </div>

                {portraitJob && pollingPortrait && (
                  <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">Generating portrait</p>
                        <p className="mt-1 text-xs text-slate-300">Status: {portraitJob.status}</p>
                      </div>
                      <span className="rounded-full border border-violet-500/20 bg-slate-950/50 px-3 py-1 text-sm font-medium text-violet-200">
                        {portraitJob.progress ?? 0}%
                      </span>
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, portraitJob.progress ?? 0))}%` }}
                      />
                    </div>
                  </div>
                )}

                {portraitError && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {portraitError}
                  </div>
                )}

                {generatedPortrait && (
                  <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4">
                    <div className="flex items-start gap-4">
                      <div className="h-28 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                        {(generatedPortrait.thumbnail_url || generatedPortrait.url) && (
                          <div
                            className="h-full w-full bg-cover bg-center"
                            style={{
                              backgroundImage: `url("${generatedPortrait.thumbnail_url || generatedPortrait.url}")`,
                            }}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">Portrait generated</p>
                        <p className="mt-1 text-xs text-slate-300">
                          Happy with this look? Make it the persona&apos;s face, or discard it and generate again.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button type="button" size="sm" onClick={handleUseGeneratedPortrait} disabled={savingPersona}>
                            Use as Portrait
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setGeneratedPortrait(null)}
                            disabled={savingPersona}
                          >
                            Discard
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>

            <div className="border-t border-slate-700/50 px-6 py-4">
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button
                  variant="ghost"
                  onClick={handleClosePersonaModal}
                  className="flex-1"
                  disabled={savingPersona}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    void handleSavePersona();
                  }}
                  loading={savingPersona}
                  disabled={!canSavePersona}
                  className="flex-1"
                >
                  {editingPersona ? 'Save Changes' : 'Create Persona'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Page Header */}
      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-violet-200">
            AI Personas
            <span className="rounded-full bg-white/10 px-2 py-0.5 tracking-normal text-white">{totalPersonas}</span>
          </div>
          <h1 className="mb-2 text-3xl font-bold text-white">Your cast of AI creators</h1>
          <p className="max-w-2xl text-slate-400">
            Design AI influencers with a consistent face, personality, and voice. Cast a persona in any ad and they
            show up exactly the same, every time.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => {
              void loadPersonas('refresh');
            }}
            loading={refreshingPersonas}
            disabled={loadingPersonas || refreshingPersonas}
          >
            <RefreshCw className="h-5 w-5" />
            Refresh
          </Button>
          <Button
            onClick={handleOpenCreateModal}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500"
          >
            <Plus className="h-5 w-5" />
            New Persona
          </Button>
        </div>
      </div>

      {/* Persona Grid */}
      {loadingPersonas ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="animate-pulse overflow-hidden border-slate-800/80">
              <div className="h-64 bg-slate-800/60" />
              <CardContent className="p-5">
                <div className="h-5 w-2/3 rounded-full bg-slate-800/80" />
                <div className="mt-3 h-3 w-full rounded-full bg-slate-800/60" />
                <div className="mt-2 h-3 w-4/5 rounded-full bg-slate-800/60" />
                <div className="mt-5 flex gap-2">
                  <div className="h-6 w-24 rounded-full bg-slate-800/60" />
                  <div className="h-6 w-20 rounded-full bg-slate-800/60" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : personas.length === 0 ? (
        <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 px-6 py-16 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500/20 to-indigo-600/20 text-violet-300 ring-1 ring-violet-500/30">
            <Users className="h-9 w-9" />
          </div>
          <h2 className="text-2xl font-semibold text-white">Create AI creators who star in your ads</h2>
          <p className="mt-3 max-w-lg text-slate-400">
            A persona is your always-available AI influencer — a generated face, a personality you write, and a voice
            you pick. Cast them in any ad and they stay perfectly consistent across every video, no reshoots required.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <Button
              size="lg"
              onClick={handleOpenCreateModal}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500"
            >
              <Plus className="h-5 w-5" />
              New Persona
            </Button>
            <p className="inline-flex items-center gap-2 text-xs text-slate-500">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              Describe a look once and generate their portrait — no camera, no casting calls.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Featured creators (pre-built presets) */}
          {presetPersonas.length > 0 && (
            <section>
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/25">
                  <Star className="h-4 w-4 fill-amber-300 text-amber-300" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-white">Featured creators</h2>
                  <p className="text-sm text-slate-500">
                    Ready-made personas you can use right away — add a copy to make them yours.
                  </p>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {presetPersonas.map((persona) => renderPersonaCard(persona))}
              </div>
            </section>
          )}

          {/* Your personas */}
          <section>
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/25">
                <UserCircle className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-white">Your personas</h2>
                <p className="text-sm text-slate-500">
                  The AI creators you&apos;ve built — fully editable and ready to cast.
                </p>
              </div>
            </div>
            {ownPersonas.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {ownPersonas.map((persona) => renderPersonaCard(persona))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 px-6 py-12 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/25">
                  <Plus className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-white">No personas of your own yet</h3>
                <p className="mt-2 max-w-md text-sm text-slate-400">
                  Build one from scratch, or use a featured creator above as a starting point.
                </p>
                <Button onClick={handleOpenCreateModal} className="mt-5">
                  <Plus className="h-5 w-5" />
                  New Persona
                </Button>
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
