import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { plural } from '@/lib/formato';
import EmptyState from '@/components/base/EmptyState';
import type { ListingKind } from '@/features/properties/listingKind';
import { getTenantSlug } from '@/services/core/tenant';
import { propertiesService, PropertyMapMarker } from '@/services/properties/propertiesService';
import CardNoMapa from './CardNoMapa';
import { destinoDoPino } from './pinoDoMapa';
import { useCardNoMapa } from './useCardNoMapa';

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

// Arrastar, dar zoom ou clicar fora do alfinete fecha o card.
function FecharAoMexer({ fechar }: { fechar: () => void }) {
  useMapEvents({ movestart: fechar, zoomstart: fechar, click: fechar });
  return null;
}

export default function VisaoMapa({ kind, podeEditar = false }: { kind: ListingKind; podeEditar?: boolean }) {
  const [markers, setMarkers] = useState<PropertyMapMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);

  const ultimaCarga = useRef(0);

  const carregar = useCallback(() => {
    const vez = ++ultimaCarga.current;
    setLoading(true);
    setErro(false);
    propertiesService
      .mapBounds({ listing_kind: kind, max: 500 })
      .then(data => { if (vez === ultimaCarga.current) setMarkers(data); })
      .catch(() => {
        if (vez !== ultimaCarga.current) return;
        setMarkers([]);
        setErro(true);
        toast.error('Erro ao carregar imóveis no mapa');
      })
      .finally(() => { if (vez === ultimaCarga.current) setLoading(false); });
  }, [kind]);

  useEffect(() => {
    carregar();
    return () => { ultimaCarga.current += 1; };
  }, [carregar]);

  const valid = useMemo(() => markers.filter(m => m.lat != null && m.lng != null), [markers]);
  const withoutCoords = markers.length - valid.length;

  const navigate = useNavigate();
  const destinoDe = useCallback((m: PropertyMapMarker) =>
    destinoDoPino(m, { podeEditar, slug: getTenantSlug(), origem: window.location.origin }), [podeEditar]);
  const irPara = useCallback((m: PropertyMapMarker) => {
    const destino = destinoDe(m);
    if (!destino) return false;
    if (destino.tipo === 'site') window.open(destino.endereco, '_blank', 'noopener');
    else navigate(destino.endereco);
    return true;
  }, [destinoDe, navigate]);
  const card = useCardNoMapa(irPara);
  const { aoEntrarNoPino, aoSairDoPino, aoClicarNoPino } = card;

  // Um jogo de eventos por alfinete, estável enquanto a lista não muda (até 500).
  const eventosDoPino = useMemo(() => new Map(valid.map(m => [m.id, {
    mouseover: (e: L.LeafletMouseEvent) => aoEntrarNoPino(m, (e.target as L.Marker).getElement() as HTMLElement),
    mouseout: () => aoSairDoPino(),
    click: (e: L.LeafletMouseEvent) => aoClicarNoPino(m, (e.target as L.Marker).getElement() as HTMLElement),
  }])), [valid, aoEntrarNoPino, aoSairDoPino, aoClicarNoPino]);

  return (
    <div className="space-y-2">
      {withoutCoords > 0 && !loading && (
        <p className="text-xs text-orange-600">
          {plural(withoutCoords, 'imóvel', 'imóveis')} sem localização no cadastro {withoutCoords === 1 ? 'não aparece' : 'não aparecem'} no mapa. Para aparecer, preencha a localização no cadastro do imóvel.
        </p>
      )}
      {/* `isolate`: as camadas do Leaflet (z-index 400 a 1000) ficam presas aqui
          dentro e não pintam por cima das janelas da casa (Novo imóvel, menus).
          Ocupa a tela abaixo das abas (pedido de 16/10), com piso de 480px. */}
      <div
        className="relative isolate h-[calc(100dvh-13rem)] min-h-[480px] rounded-xl border overflow-hidden"
        onPointerMoveCapture={e => card.aoVerPonteiro(e.pointerType)}
        onPointerDownCapture={e => card.aoVerPonteiro(e.pointerType)}
      >
        {loading && (
          <Loader2 className="absolute right-3 top-3 z-[500] h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {valid.length === 0 && !loading && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-background/80 pointer-events-none">
            {/* A camada é pointer-events-none (deixa o mapa arrastar); o aviso de erro precisa do clique. */}
            {erro ? (
              <EmptyState tipo="erro" tamanho="compacto" aoTentarDeNovo={carregar} className="pointer-events-auto max-w-md bg-card" />
            ) : (
              <EmptyState
                tamanho="compacto"
                title="Nenhum imóvel desta aba tem localização no cadastro ainda."
                className="max-w-md bg-card"
              />
            )}
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
          <FecharAoMexer fechar={card.fechar} />
          {valid.map(m => (
            <Marker
              key={m.id}
              position={[m.lat as number, m.lng as number]}
              icon={customIcon}
              title={m.title}
              eventHandlers={eventosDoPino.get(m.id)}
            />
          ))}
        </MapContainer>
      </div>
      <CardNoMapa
        alvo={card.alvo}
        destino={card.alvo ? destinoDe(card.alvo.imovel) : null}
        onEntrar={card.segurar}
        onSair={card.fecharDepois}
      />
    </div>
  );
}
