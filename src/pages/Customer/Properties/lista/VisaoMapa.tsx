import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Badge } from '@/components/ui/ds';
import {
  Building2, Bed, Bath, Car, Ruler, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { plural } from '@/lib/formato';
import type { ListingKind } from '@/features/properties/listingKind';
import {
  propertiesService,
  PropertyMapMarker,
  TRANSACTION_TYPE_LABELS,
  PROPERTY_TYPE_LABELS,
} from '@/services/properties/propertiesService';

// Marker icon padrão do Leaflet quebra em bundlers — re-importar via CDN-style icon.
const customIcon = L.divIcon({
  className: 'lmflow-property-marker',
  html: `
    <div style="
      width: 32px; height: 32px;
      background: #7c3aed;
      border: 2px solid #fff;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 6px rgba(0,0,0,.3);
      display: flex; align-items: center; justify-content: center;
    ">
      <div style="
        transform: rotate(45deg);
        color: #fff;
        font-weight: 700;
        font-size: 12px;
        line-height: 1;
      ">$</div>
    </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Centro inicial: Brasil (-15, -50) — fit automático quando markers chegam.
const DEFAULT_CENTER: [number, number] = [-23.5505, -46.6333]; // São Paulo
const DEFAULT_ZOOM = 11;

function FitBoundsToMarkers({ markers }: { markers: PropertyMapMarker[] }) {
  const map = useMap();
  useEffect(() => {
    const valid = markers.filter(m => m.lat != null && m.lng != null);
    if (!valid.length) return;
    const bounds = L.latLngBounds(valid.map(m => [m.lat as number, m.lng as number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [markers, map]);
  return null;
}

export default function VisaoMapa({ kind }: { kind: ListingKind }) {
  const [markers, setMarkers] = useState<PropertyMapMarker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    propertiesService
      .mapBounds({ listing_kind: kind, max: 500 })
      .then(data => { if (ativo) setMarkers(data); })
      .catch(() => { if (ativo) toast.error('Erro ao carregar imóveis no mapa'); })
      .finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [kind]);

  const valid = useMemo(() => markers.filter(m => m.lat != null && m.lng != null), [markers]);
  const withoutCoords = markers.length - valid.length;

  return (
    <div className="space-y-2">
      {withoutCoords > 0 && !loading && (
        <p className="text-xs text-orange-600">
          {plural(withoutCoords, 'imóvel', 'imóveis')} sem localização no cadastro {withoutCoords === 1 ? 'não aparece' : 'não aparecem'} no mapa. Para aparecer, preencha a localização no cadastro do imóvel.
        </p>
      )}
      {/* `isolate`: as camadas do Leaflet (z-index 400 a 1000) ficam presas aqui
          dentro e não pintam por cima das janelas da casa (Novo imóvel, menus). */}
      <div className="relative isolate h-[480px] rounded-xl border overflow-hidden">
        {loading && (
          <Loader2 className="absolute right-3 top-3 z-[500] h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {valid.length === 0 && !loading && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-background/80 pointer-events-none">
            <div className="bg-card border border-border rounded-lg p-6 text-center max-w-md">
              <Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium">Nenhum imóvel desta aba tem localização no cadastro ainda.</p>
            </div>
          </div>
        )}
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBoundsToMarkers markers={valid} />
          {valid.map(m => (
            <Marker key={m.id} position={[m.lat as number, m.lng as number]} icon={customIcon}>
              <Popup>
                <div className="space-y-2 min-w-[200px]">
                  <div>
                    <p className="font-medium text-sm leading-tight">{m.title}</p>
                    <p className="text-xs text-muted-foreground font-mono">{m.code}</p>
                  </div>
                  {m.display_price && (
                    <p className="text-base font-bold text-primary">{m.display_price}</p>
                  )}
                  <div className="flex gap-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">
                      {TRANSACTION_TYPE_LABELS[m.transaction_type] ?? m.transaction_type}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {PROPERTY_TYPE_LABELS[m.property_type] ?? m.property_type}
                    </Badge>
                  </div>
                  {m.icon_summary && (
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      {m.icon_summary.bedrooms > 0 && <span className="flex items-center gap-0.5"><Bed className="h-3 w-3" />{m.icon_summary.bedrooms}</span>}
                      {m.icon_summary.bathrooms > 0 && <span className="flex items-center gap-0.5"><Bath className="h-3 w-3" />{m.icon_summary.bathrooms}</span>}
                      {m.icon_summary.parking > 0 && <span className="flex items-center gap-0.5"><Car className="h-3 w-3" />{m.icon_summary.parking}</span>}
                      {m.icon_summary.useful_area_m2 > 0 && <span className="flex items-center gap-0.5"><Ruler className="h-3 w-3" />{m.icon_summary.useful_area_m2}m²</span>}
                    </div>
                  )}
                  {(m.neighborhood || m.city) && (
                    <p className="text-xs text-muted-foreground">
                      {[m.neighborhood, m.city].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
