import { AssetItem, AssetType } from '@/types';

export type LibraryAssetSource = 'uploaded' | 'ai_generated';
export type LibraryAssetSourceFilter = 'all' | 'generated' | 'uploaded';

export interface LibraryAsset {
  id: string;
  title: string;
  type: AssetType;
  source: LibraryAssetSource;
  url: string;
  duration_seconds: number;
  thumbnailUrl?: string;
}

export function getFallbackAssetDurationSeconds(assetType: AssetType) {
  switch (assetType) {
    case 'image':
      return 2;
    case 'video':
      return 5;
    case 'audio':
      return 10;
    default:
      return 5;
  }
}

export function formatLibraryAssetDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function mapAssetItemToLibraryAsset(item: AssetItem): LibraryAsset {
  const fallbackDuration = getFallbackAssetDurationSeconds(item.asset_type);
  const mappedDurationSeconds =
    item.asset_type === 'image'
      ? fallbackDuration
      : typeof item.duration_ms === 'number' && item.duration_ms > 0
        ? item.duration_ms / 1000
        : fallbackDuration;

  const baseAsset = {
    id: item.id,
    title: item.title,
    source: item.source_type === 'generated' ? 'ai_generated' : 'uploaded',
    url: item.url || item.thumbnail_url || '#',
    duration_seconds: mappedDurationSeconds,
  } as const;

  switch (item.asset_type) {
    case 'image':
      return {
        ...baseAsset,
        type: 'image',
        thumbnailUrl: item.thumbnail_url || item.url || undefined,
      };
    case 'video':
      return {
        ...baseAsset,
        type: 'video',
        thumbnailUrl: item.thumbnail_url || item.url || '#',
      };
    case 'audio':
      return {
        ...baseAsset,
        type: 'audio',
        thumbnailUrl: item.thumbnail_url || item.url || undefined,
      };
    default:
      return {
        ...baseAsset,
        type: 'image',
        thumbnailUrl: item.thumbnail_url || item.url || undefined,
      };
  }
}

export function mergeLibraryAssetsById(currentAssets: LibraryAsset[], nextAssets: LibraryAsset[]) {
  const assetMap = new Map<string, LibraryAsset>();

  currentAssets.forEach((asset) => {
    assetMap.set(asset.id, asset);
  });

  nextAssets.forEach((asset) => {
    assetMap.set(asset.id, asset);
  });

  return Array.from(assetMap.values());
}

export function getFileAssetType(file: File): AssetType | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return null;
}
