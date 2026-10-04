// Mapa pequeno da Localização do cadastro: um alfinete arrastável no ponto do imóvel.
// Carregado sob demanda (React.lazy) pela SecaoLocalizacao, como a VisaoMapa da lista.
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CENTRO_DO_BRASIL } from '@/features/properties/localizacao';

// O mesmo alfinete roxo da VisaoMapa (o ícone padrão do Leaflet quebra em bundlers).
const alfinete = L.divIcon({
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

interface Props {
  lat: number | null;
  lng: number | null;
  zoom: number;
  aoArrastar: (lat: number, lng: number) => void;
}

// Recentraliza quando o ponto (ou o zoom) muda por fora — busca pelo endereço,
// CEP. O ponto que acabou de vir do próprio arraste não recentraliza (o mapa não "pula").
function Recentralizar({ centro, zoom, arrastado }: {
  centro: [number, number]; zoom: number; arrastado: MutableRefObject<[number, number] | null>;
}) {
  const map = useMap();
  const [lat, lng] = centro;
  useEffect(() => {
    const a = arrastado.current;
    if (a && a[0] === lat && a[1] === lng) return;
    map.setView([lat, lng], zoom);
  }, [map, lat, lng, zoom, arrastado]);
  return null;
}

// Sem ponto (lat/lng nulos): o mapa abre no Brasil, sem alfinete — um arraste sem
// querer, nesse zoom, gravaria um ponto qualquer.
export default function MapaDoCadastro({ lat, lng, zoom, aoArrastar }: Props) {
  const temPonto = lat != null && lng != null;
  const centro = useMemo<[number, number]>(
    () => (lat != null && lng != null ? [lat, lng] : CENTRO_DO_BRASIL), [lat, lng],
  );
  const arrastado = useRef<[number, number] | null>(null);
  // O Marker do react-leaflet religa os eventos quando o objeto muda: fica o mesmo, e chama a função mais recente.
  const aoArrastarRef = useRef(aoArrastar);
  useEffect(() => { aoArrastarRef.current = aoArrastar; }, [aoArrastar]);
  const eventos = useMemo(() => ({
    dragend: (e: L.LeafletEvent) => {
      const { lat: novaLat, lng: novaLng } = (e.target as L.Marker).getLatLng();
      arrastado.current = [novaLat, novaLng];
      aoArrastarRef.current(novaLat, novaLng);
    },
  }), []);
  return (
    // `isolate`: as camadas do Leaflet (z-index 400 a 1000) não pintam por cima das janelas da casa.
    <div className="relative isolate h-[240px] overflow-hidden rounded-xl border">
      <MapContainer center={centro} zoom={zoom} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recentralizar centro={centro} zoom={zoom} arrastado={arrastado} />
        {temPonto && <Marker position={centro} icon={alfinete} draggable eventHandlers={eventos} />}
      </MapContainer>
    </div>
  );
}
