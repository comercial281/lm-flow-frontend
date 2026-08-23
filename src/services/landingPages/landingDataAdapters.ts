import type { LandingPhoto } from '@/features/landing/blocks';
import type { PropertyPhoto } from '@/services/propertyPhotos/propertyPhotosService';

/** PropertyPhoto[] (API) -> LandingPhoto[] consumed by the block renderer. */
export function toLandingPhotos(photos: PropertyPhoto[]): LandingPhoto[] {
  return photos
    .filter((p) => p.published)
    .map((p) => ({
      url: p.file_url,
      thumbnailUrl: p.thumbnail_url ?? undefined,
      caption: p.caption ?? undefined,
      alt: p.alt_text ?? undefined,
      isCover: p.is_cover,
    }));
}
