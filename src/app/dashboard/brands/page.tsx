'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image as ImageIcon,
  Mic,
  Music,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Toast } from '@/components/ui/Toast';
import { AssetPickerModal } from '@/components/assets/AssetPickerModal';
import { api, brandsApi, getApiErrorMessage } from '@/lib/api';
import { AssetItem, Brand, BrandPayload } from '@/types';

type ToastState = {
  open: boolean;
  title?: string;
  message: string;
  variant: 'error' | 'success' | 'info';
};

const TONE_OPTIONS = ['premium', 'playful', 'bold', 'friendly', 'professional', 'edgy'];

// Mirrors the SUBTITLE_PRESETS list used by the custom video create page.
const SUBTITLE_STYLE_OPTIONS = [
  { id: 'mrbeast', name: 'MrBeast' },
  { id: 'hormozi', name: 'Hormozi' },
  { id: 'tiktok_glow', name: 'TikTok Glow' },
  { id: 'netflix', name: 'Netflix' },
  { id: 'karaoke', name: 'Karaoke' },
  { id: 'gradient_pop', name: 'Gradient Pop' },
  { id: 'comic_punch', name: 'Comic Punch' },
  { id: 'typewriter', name: 'Typewriter' },
  { id: 'neon_outline', name: 'Neon Outline' },
  { id: 'glassmorphism', name: 'Glassmorphism' },
  { id: 'shadow_stack', name: 'Shadow Stack' },
  { id: 'minimal_box', name: 'Minimal Box' },
  { id: 'bold_impact', name: 'Bold Impact' },
  { id: 'cinematic', name: 'Cinematic' },
  { id: 'retro_vhs', name: 'Retro VHS' },
  { id: 'emoji_burst', name: 'Emoji Burst' },
];

// Mirrors the mood list supported by the backend music service.
const MUSIC_MOOD_OPTIONS = [
  'happy',
  'sad',
  'intense',
  'romantic',
  'neutral',
  'cinematic',
  'upbeat',
  'tense',
  'documentary',
  'ambient',
];

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_PRIMARY_COLOR = '#8b5cf6';
const DEFAULT_SECONDARY_COLOR = '#6366f1';

const selectClassName =
  'block h-11 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-white transition-all duration-200 ease-out focus:border-violet-500/60 focus:outline-none focus:ring-2 focus:ring-violet-500/20';

interface BrandFormState {
  name: string;
  productDescription: string;
  tone: string;
  primaryColor: string;
  secondaryColor: string;
  voiceId: string;
  subtitleStyle: string;
  musicMood: string;
  logoAssetId: string | null;
  logoPreviewUrl: string | null;
}

const EMPTY_FORM: BrandFormState = {
  name: '',
  productDescription: '',
  tone: '',
  primaryColor: '',
  secondaryColor: '',
  voiceId: '',
  subtitleStyle: '',
  musicMood: '',
  logoAssetId: null,
  logoPreviewUrl: null,
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getSubtitleStyleName(styleId: string) {
  return SUBTITLE_STYLE_OPTIONS.find((style) => style.id === styleId)?.name || styleId;
}

function getBrandGradient(brand: Brand) {
  const primary = brand.primary_color || DEFAULT_PRIMARY_COLOR;
  const secondary = brand.secondary_color || DEFAULT_SECONDARY_COLOR;
  return `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`;
}

function buildFormFromBrand(brand: Brand, logoPreviewUrl: string | null): BrandFormState {
  return {
    name: brand.name,
    productDescription: brand.product_description || '',
    tone: brand.tone || '',
    primaryColor: brand.primary_color || '',
    secondaryColor: brand.secondary_color || '',
    voiceId: brand.default_voice_id || '',
    subtitleStyle: brand.default_subtitle_style || '',
    musicMood: brand.default_music_mood || '',
    logoAssetId: brand.logo_asset_id,
    logoPreviewUrl,
  };
}

interface ColorFieldProps {
  label: string;
  value: string;
  fallbackColor: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

function ColorField({ label, value, fallbackColor, disabled, onChange }: ColorFieldProps) {
  const isValidHex = HEX_COLOR_PATTERN.test(value);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-300">{label}</label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            disabled={disabled}
            className="text-xs font-medium text-slate-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={isValidHex ? value : fallbackColor}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.03] p-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`${label} picker`}
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={fallbackColor}
          disabled={disabled}
          error={value && !isValidHex ? 'Use a 6-digit hex value like #8b5cf6.' : undefined}
        />
      </div>
    </div>
  );
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [totalBrands, setTotalBrands] = useState(0);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [refreshingBrands, setRefreshingBrands] = useState(false);
  const [logoAssetCache, setLogoAssetCache] = useState<Record<string, AssetItem | null>>({});

  // Create / Edit Modal State
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [form, setForm] = useState<BrandFormState>(EMPTY_FORM);
  const [savingBrand, setSavingBrand] = useState(false);
  const [showLogoPicker, setShowLogoPicker] = useState(false);

  // Delete State
  const [brandToDelete, setBrandToDelete] = useState<Brand | null>(null);
  const [deletingBrandId, setDeletingBrandId] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: '',
    variant: 'info',
  });
  const toastTimeoutRef = useRef<number | null>(null);

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

  const loadBrands = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') {
      setLoadingBrands(true);
    } else {
      setRefreshingBrands(true);
    }

    try {
      const data = await brandsApi.list();
      setBrands(data.items);
      setTotalBrands(data.total);
    } catch (error) {
      console.error('Failed to load brands:', error);
      showToast(getApiErrorMessage(error, 'Failed to load brands.'), 'error', 'Load Failed');
    } finally {
      setLoadingBrands(false);
      setRefreshingBrands(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadBrands();
  }, [loadBrands]);

  useEffect(() => {
    const missingLogoIds = Array.from(
      new Set(
        brands
          .map((brand) => brand.logo_asset_id)
          .filter((assetId): assetId is string => !!assetId)
      )
    ).filter((assetId) => !(assetId in logoAssetCache));

    if (missingLogoIds.length === 0) {
      return;
    }

    let cancelled = false;

    const fetchLogoAssets = async () => {
      const entries = await Promise.all(
        missingLogoIds.map(async (assetId) => {
          try {
            const res = await api.get(`/api/assets/${assetId}`);
            return [assetId, res.data as AssetItem] as const;
          } catch (error) {
            console.error('Failed to load brand logo asset:', error);
            return [assetId, null] as const;
          }
        })
      );

      if (!cancelled) {
        setLogoAssetCache((currentCache) => ({
          ...currentCache,
          ...Object.fromEntries(entries),
        }));
      }
    };

    void fetchLogoAssets();

    return () => {
      cancelled = true;
    };
  }, [brands, logoAssetCache]);

  useEffect(() => {
    // Handle body overflow for the brand modal
    const previousOverflow = document.body.style.overflow;
    if (showBrandModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = previousOverflow;
    }
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showBrandModal]);

  const getLogoUrl = useCallback((logoAssetId: string | null) => {
    if (!logoAssetId) {
      return null;
    }

    const asset = logoAssetCache[logoAssetId];
    return asset?.thumbnail_url || asset?.url || null;
  }, [logoAssetCache]);

  const handleOpenCreateModal = () => {
    setEditingBrand(null);
    setForm(EMPTY_FORM);
    setShowBrandModal(true);
  };

  const handleOpenEditModal = (brand: Brand) => {
    setEditingBrand(brand);
    setForm(buildFormFromBrand(brand, getLogoUrl(brand.logo_asset_id)));
    setShowBrandModal(true);
  };

  const handleCloseBrandModal = () => {
    if (savingBrand) {
      return;
    }

    setShowBrandModal(false);
    setShowLogoPicker(false);
    setEditingBrand(null);
    setForm(EMPTY_FORM);
  };

  const hasInvalidColor =
    (!!form.primaryColor && !HEX_COLOR_PATTERN.test(form.primaryColor)) ||
    (!!form.secondaryColor && !HEX_COLOR_PATTERN.test(form.secondaryColor));
  const canSaveBrand = !savingBrand && form.name.trim().length > 0 && !hasInvalidColor;

  const handleSaveBrand = async () => {
    if (!canSaveBrand) {
      return;
    }

    const payload: BrandPayload = {
      name: form.name.trim(),
      product_description: form.productDescription.trim() || null,
      tone: form.tone || null,
      logo_asset_id: form.logoAssetId,
      primary_color: form.primaryColor ? form.primaryColor.toLowerCase() : null,
      secondary_color: form.secondaryColor ? form.secondaryColor.toLowerCase() : null,
      default_voice_id: form.voiceId.trim() || null,
      default_subtitle_style: form.subtitleStyle || null,
      default_music_mood: form.musicMood || null,
    };

    setSavingBrand(true);
    try {
      if (editingBrand) {
        const updatedBrand = await brandsApi.update(editingBrand.id, payload);
        setBrands((currentBrands) =>
          currentBrands.map((brand) => (brand.id === updatedBrand.id ? updatedBrand : brand))
        );
        showToast(`"${updatedBrand.name}" has been updated.`, 'success', 'Brand Saved');
      } else {
        const createdBrand = await brandsApi.create(payload);
        setBrands((currentBrands) => [createdBrand, ...currentBrands]);
        setTotalBrands((currentTotal) => currentTotal + 1);
        showToast(`"${createdBrand.name}" is ready to keep your ads on-brand.`, 'success', 'Brand Created');
      }

      setShowBrandModal(false);
      setShowLogoPicker(false);
      setEditingBrand(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      console.error('Failed to save brand:', error);
      showToast(getApiErrorMessage(error, 'Failed to save brand.'), 'error', 'Save Failed');
    } finally {
      setSavingBrand(false);
    }
  };

  const handleDeleteBrand = async () => {
    if (!brandToDelete) {
      return;
    }

    setDeletingBrandId(brandToDelete.id);
    try {
      await brandsApi.remove(brandToDelete.id);
      setBrands((currentBrands) => currentBrands.filter((brand) => brand.id !== brandToDelete.id));
      setTotalBrands((currentTotal) => Math.max(0, currentTotal - 1));
      showToast(`"${brandToDelete.name}" has been deleted.`, 'success', 'Brand Deleted');
      setBrandToDelete(null);
    } catch (error) {
      console.error('Failed to delete brand:', error);
      showToast(getApiErrorMessage(error, 'Failed to delete brand.'), 'error', 'Delete Failed');
    } finally {
      setDeletingBrandId(null);
    }
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
        open={!!brandToDelete}
        title="Delete brand?"
        description={
          brandToDelete
            ? `"${brandToDelete.name}" will be permanently removed. Videos already generated with it are not affected.`
            : ''
        }
        confirmLabel="Delete Brand"
        loading={deletingBrandId === brandToDelete?.id}
        onClose={() => {
          if (!deletingBrandId) {
            setBrandToDelete(null);
          }
        }}
        onConfirm={() => {
          void handleDeleteBrand();
        }}
      />

      <AssetPickerModal
        isOpen={showLogoPicker}
        onClose={() => setShowLogoPicker(false)}
        allowedTypes={['image']}
        onSelectAsset={(asset) => {
          setForm((currentForm) => ({
            ...currentForm,
            logoAssetId: asset.id,
            logoPreviewUrl: asset.thumbnailUrl || asset.url,
          }));
        }}
      />

      {/* Create / Edit Brand Modal */}
      {showBrandModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={handleCloseBrandModal}
        >
          <Card
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden border-slate-700/70 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative border-b border-slate-700/50 p-6">
              <h2 className="text-2xl font-semibold text-white">
                {editingBrand ? 'Edit Brand' : 'New Brand'}
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Define your brand once — its logo, colors, tone, voice, and defaults are applied to every ad you generate.
              </p>
              <button
                type="button"
                onClick={handleCloseBrandModal}
                disabled={savingBrand}
                className="absolute right-4 top-4 rounded-full border border-white/10 bg-slate-800/50 p-2 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close brand editor"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <CardContent className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
              {/* Logo */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">Logo</label>
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
                    {form.logoPreviewUrl ? (
                      <div
                        className="h-full w-full bg-contain bg-center bg-no-repeat"
                        style={{ backgroundImage: `url("${form.logoPreviewUrl}")` }}
                      />
                    ) : form.logoAssetId ? (
                      <ImageIcon className="h-7 w-7 text-slate-500" />
                    ) : (
                      <Palette className="h-7 w-7 text-slate-600" />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowLogoPicker(true)}
                      disabled={savingBrand}
                    >
                      <ImageIcon className="h-4 w-4" />
                      {form.logoAssetId ? 'Change Logo' : 'Choose Logo'}
                    </Button>
                    {form.logoAssetId && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setForm((currentForm) => ({
                            ...currentForm,
                            logoAssetId: null,
                            logoPreviewUrl: null,
                          }))
                        }
                        disabled={savingBrand}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Pick an image asset from your library, or upload one from inside the picker.
                </p>
              </div>

              <Input
                label="Name *"
                value={form.name}
                onChange={(event) => setForm((currentForm) => ({ ...currentForm, name: event.target.value }))}
                placeholder="e.g. Acme Skincare"
                disabled={savingBrand}
              />

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">Product Description</label>
                <textarea
                  value={form.productDescription}
                  onChange={(event) =>
                    setForm((currentForm) => ({ ...currentForm, productDescription: event.target.value }))
                  }
                  rows={4}
                  disabled={savingBrand}
                  placeholder="What does this brand sell? Who is it for? The more detail, the more on-brand your generated ads will be."
                  className="block w-full rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-white placeholder-slate-500 transition-all duration-200 ease-out focus:border-violet-500/60 focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">Tone</label>
                  <select
                    value={form.tone}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, tone: event.target.value }))}
                    disabled={savingBrand}
                    className={selectClassName}
                  >
                    <option value="">No tone</option>
                    {TONE_OPTIONS.map((tone) => (
                      <option key={tone} value={tone}>
                        {capitalize(tone)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">Default Music Mood</label>
                  <select
                    value={form.musicMood}
                    onChange={(event) =>
                      setForm((currentForm) => ({ ...currentForm, musicMood: event.target.value }))
                    }
                    disabled={savingBrand}
                    className={selectClassName}
                  >
                    <option value="">No default mood</option>
                    {MUSIC_MOOD_OPTIONS.map((mood) => (
                      <option key={mood} value={mood}>
                        {capitalize(mood)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <ColorField
                  label="Primary Color"
                  value={form.primaryColor}
                  fallbackColor={DEFAULT_PRIMARY_COLOR}
                  disabled={savingBrand}
                  onChange={(value) => setForm((currentForm) => ({ ...currentForm, primaryColor: value }))}
                />
                <ColorField
                  label="Secondary Color"
                  value={form.secondaryColor}
                  fallbackColor={DEFAULT_SECONDARY_COLOR}
                  disabled={savingBrand}
                  onChange={(value) => setForm((currentForm) => ({ ...currentForm, secondaryColor: value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">Default Subtitle Style</label>
                <select
                  value={form.subtitleStyle}
                  onChange={(event) =>
                    setForm((currentForm) => ({ ...currentForm, subtitleStyle: event.target.value }))
                  }
                  disabled={savingBrand}
                  className={selectClassName}
                >
                  <option value="">No default style</option>
                  {SUBTITLE_STYLE_OPTIONS.map((style) => (
                    <option key={style.id} value={style.id}>
                      {style.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Input
                  label="ElevenLabs Voice ID"
                  value={form.voiceId}
                  onChange={(event) => setForm((currentForm) => ({ ...currentForm, voiceId: event.target.value }))}
                  placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
                  disabled={savingBrand}
                />
                <p className="text-xs text-slate-500">
                  Paste a voice ID from your ElevenLabs voice library. It becomes the default narration voice for ads generated with this brand.
                </p>
              </div>
            </CardContent>

            <div className="border-t border-slate-700/50 px-6 py-4">
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button
                  variant="ghost"
                  onClick={handleCloseBrandModal}
                  className="flex-1"
                  disabled={savingBrand}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    void handleSaveBrand();
                  }}
                  loading={savingBrand}
                  disabled={!canSaveBrand}
                  className="flex-1"
                >
                  {editingBrand ? 'Save Changes' : 'Create Brand'}
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
            Brand Kits
            <span className="rounded-full bg-white/10 px-2 py-0.5 tracking-normal text-white">{totalBrands}</span>
          </div>
          <h1 className="mb-2 text-3xl font-bold text-white">Keep every ad on-brand</h1>
          <p className="max-w-2xl text-slate-400">
            Save your logo, colors, tone, and narration defaults once. Every video you generate with a brand stays consistent automatically.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => {
              void loadBrands('refresh');
            }}
            loading={refreshingBrands}
            disabled={loadingBrands || refreshingBrands}
          >
            <RefreshCw className="h-5 w-5" />
            Refresh
          </Button>
          <Button
            onClick={handleOpenCreateModal}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500"
          >
            <Plus className="h-5 w-5" />
            New Brand
          </Button>
        </div>
      </div>

      {/* Brand Grid */}
      {loadingBrands ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="animate-pulse overflow-hidden border-slate-800/80">
              <div className="h-20 bg-slate-800/60" />
              <CardContent className="p-5 pt-0">
                <div className="-mt-8 mb-4 h-16 w-16 rounded-2xl border border-slate-800 bg-slate-900" />
                <div className="h-5 w-2/3 rounded-full bg-slate-800/80" />
                <div className="mt-3 h-3 w-full rounded-full bg-slate-800/60" />
                <div className="mt-2 h-3 w-4/5 rounded-full bg-slate-800/60" />
                <div className="mt-5 flex gap-2">
                  <div className="h-6 w-20 rounded-full bg-slate-800/60" />
                  <div className="h-6 w-24 rounded-full bg-slate-800/60" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : brands.length === 0 ? (
        <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 px-6 py-16 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500/20 to-indigo-600/20 text-violet-300 ring-1 ring-violet-500/30">
            <Palette className="h-9 w-9" />
          </div>
          <h2 className="text-2xl font-semibold text-white">Create your first brand kit</h2>
          <p className="mt-3 max-w-lg text-slate-400">
            A brand stores your logo, colors, tone of voice, narration voice, and subtitle and music defaults.
            Attach it when generating an ad and every scene stays unmistakably yours — no re-entering details each time.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <Button
              size="lg"
              onClick={handleOpenCreateModal}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500"
            >
              <Plus className="h-5 w-5" />
              New Brand
            </Button>
            <p className="inline-flex items-center gap-2 text-xs text-slate-500">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              Brands are entered manually — you stay in full control of every detail.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {brands.map((brand) => {
            const logoUrl = getLogoUrl(brand.logo_asset_id);

            return (
              <Card key={brand.id} hover className="group overflow-hidden border-slate-800/80 bg-slate-950/60">
                {/* Gradient banner from brand colors */}
                <div className="relative h-20" style={{ background: getBrandGradient(brand) }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0f]/80 via-[#0b0b0f]/20 to-transparent" />
                  <div className="absolute right-3 top-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(brand)}
                      className="rounded-full border border-white/10 bg-slate-950/70 p-2 text-slate-200 transition-colors hover:bg-slate-900 hover:text-white"
                      aria-label={`Edit ${brand.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setBrandToDelete(brand)}
                      className="rounded-full border border-white/10 bg-slate-950/70 p-2 text-slate-200 transition-colors hover:bg-red-500/20 hover:text-red-300"
                      aria-label={`Delete ${brand.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <CardContent className="p-5 pt-0">
                  <div className="-mt-8 mb-4 flex items-end justify-between">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-lg shadow-black/40">
                      {logoUrl ? (
                        <div
                          className="h-full w-full bg-contain bg-center bg-no-repeat"
                          style={{ backgroundImage: `url("${logoUrl}")` }}
                        />
                      ) : (
                        <Palette className="h-6 w-6 text-slate-600" />
                      )}
                    </div>

                    <div className="flex items-center gap-2 pb-1">
                      {brand.primary_color || brand.secondary_color ? (
                        <>
                          {brand.primary_color && (
                            <span
                              className="h-5 w-5 rounded-full border border-white/20"
                              style={{ backgroundColor: brand.primary_color }}
                              title={`Primary ${brand.primary_color}`}
                            />
                          )}
                          {brand.secondary_color && (
                            <span
                              className="h-5 w-5 rounded-full border border-white/20"
                              style={{ backgroundColor: brand.secondary_color }}
                              title={`Secondary ${brand.secondary_color}`}
                            />
                          )}
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-600">No colors set</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <h3 className="min-w-0 truncate text-lg font-semibold text-white">{brand.name}</h3>
                    {brand.tone && (
                      <span className="shrink-0 rounded-full border border-violet-500/30 bg-violet-500/15 px-2.5 py-0.5 text-xs font-medium capitalize text-violet-200">
                        {brand.tone}
                      </span>
                    )}
                  </div>

                  {brand.product_description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-400">{brand.product_description}</p>
                  ) : (
                    <p className="mt-2 text-sm italic text-slate-600">No product description yet.</p>
                  )}

                  {(brand.default_subtitle_style || brand.default_music_mood || brand.default_voice_id) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {brand.default_subtitle_style && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-xs text-slate-300">
                          <Type className="h-3.5 w-3.5 text-slate-500" />
                          {getSubtitleStyleName(brand.default_subtitle_style)}
                        </span>
                      )}
                      {brand.default_music_mood && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-xs text-slate-300">
                          <Music className="h-3.5 w-3.5 text-slate-500" />
                          {capitalize(brand.default_music_mood)}
                        </span>
                      )}
                      {brand.default_voice_id && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-xs text-slate-300">
                          <Mic className="h-3.5 w-3.5 text-slate-500" />
                          Voice set
                        </span>
                      )}
                    </div>
                  )}

                  <p className="mt-4 border-t border-white/[0.06] pt-3 text-xs text-slate-500">
                    Updated {formatDateTime(brand.updated_at)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
