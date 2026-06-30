import type { Property } from '@/services/properties/propertiesService';
import type { LandingPhoto, LandingProperty } from './render-types';

/**
 * Adapts the app's `Property` service type into the package-local
 * `LandingProperty` consumed by the block render components, so the editor
 * preview shows real data. The public Next.js renderer builds the same shape
 * straight from the API JSON.
 */
export function toLandingProperty(
  property: Property,
  photos: LandingPhoto[] = [],
): LandingProperty {
  return {
    code: property.code,
    title: property.title,
    description: property.description,
    stage: property.stage,
    salePrice: property.sale_price ?? null,
    displayPrice: property.display_price,
    bedrooms: property.bedrooms ?? null,
    bathrooms: property.bathrooms ?? null,
    suites: property.suites ?? null,
    parkingSpaces: property.parking_spaces ?? null,
    usefulAreaM2: property.useful_area_m2 ?? null,
    totalAreaM2: property.total_area_m2 ?? null,
    city: property.address_city,
    neighborhood: property.address_neighborhood,
    state: property.address_state,
    fullAddress: property.full_address,
    latitude: property.latitude ?? null,
    longitude: property.longitude ?? null,
    photos,
    responsibleName: property.responsible?.name,
  };
}
