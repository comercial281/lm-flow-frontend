// src/pages/Customer/Properties/lista/CardNoMapa.tsx
// O card do imóvel que abre em cima do alfinete no Mapa (16/10/2026). O card
// inteiro é o link pro imóvel (site ou cadastro, regra em `destinoDoPino`).
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Bath, Bed, Building2, Car, MapPin, Ruler } from 'lucide-react';
import {
  PROPERTY_TYPE_LABELS,
  TRANSACTION_TYPE_LABELS,
  type PropertyMapMarker,
} from '@/services/properties/propertiesService';
import { TEXTO_SEM_DESTINO, localDoPino, posicaoDoCardNoMapa, type DestinoDoPino } from './pinoDoMapa';

const LARGURA = 272;

export interface AlvoDoCardNoMapa {
  imovel: PropertyMapMarker;
  pino: { left: number; right: number; top: number; bottom: number };
}

interface Props {
  alvo: AlvoDoCardNoMapa | null;
  destino: DestinoDoPino | null;
  onEntrar: () => void;
  onSair: () => void;
}

export default function CardNoMapa(props: Props) {
  if (!props.alvo) return null;
  return createPortal(<Conteudo key={props.alvo.imovel.id} {...props} alvo={props.alvo} />, document.body);
}

function Conteudo({ alvo, destino, onEntrar, onSair }: Props & { alvo: AlvoDoCardNoMapa }) {
  const m = alvo.imovel;
  const [fotoFalhou, setFotoFalhou] = useState(false);
  const foto = m.cover_photo_url && !fotoFalhou ? m.cover_photo_url : null;
  const local = localDoPino(m);
  const ic = m.icon_summary;

  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const altura = ref.current?.offsetHeight ?? 0;
    const p = posicaoDoCardNoMapa(alvo.pino, { largura: window.innerWidth, altura: window.innerHeight },
      { largura: LARGURA, altura });
    setPos({ left: p.left, top: p.top });
  }, [alvo]);

  const miolo = (
    <>
      <div className="relative h-36 overflow-hidden bg-muted">
        {foto ? (
          <img src={foto} alt="" onError={() => setFotoFalhou(true)} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Building2 className="h-7 w-7 opacity-40" aria-hidden />
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">{m.code}</span>
      </div>
      <div className="grid gap-1.5 p-3">
        <p className="line-clamp-2 font-semibold leading-snug">{m.title}</p>
        {m.display_price && <p className="text-base font-bold text-primary">{m.display_price}</p>}
        <p className="text-xs text-muted-foreground">
          {[PROPERTY_TYPE_LABELS[m.property_type] ?? m.property_type, TRANSACTION_TYPE_LABELS[m.transaction_type] ?? m.transaction_type]
            .filter(Boolean).join(' · ')}
        </p>
        {ic && (ic.bedrooms > 0 || ic.bathrooms > 0 || ic.parking > 0 || ic.useful_area_m2 > 0) && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {ic.bedrooms > 0 && <Icone icone={<Bed className="h-3.5 w-3.5" />} texto={`${ic.bedrooms} ${ic.bedrooms === 1 ? 'quarto' : 'quartos'}`} />}
            {ic.bathrooms > 0 && <Icone icone={<Bath className="h-3.5 w-3.5" />} texto={`${ic.bathrooms} ${ic.bathrooms === 1 ? 'banheiro' : 'banheiros'}`} />}
            {ic.parking > 0 && <Icone icone={<Car className="h-3.5 w-3.5" />} texto={`${ic.parking} ${ic.parking === 1 ? 'vaga' : 'vagas'}`} />}
            {ic.useful_area_m2 > 0 && <Icone icone={<Ruler className="h-3.5 w-3.5" />} texto={`${ic.useful_area_m2} m²`} />}
          </div>
        )}
        {local && <Icone icone={<MapPin className="h-3.5 w-3.5" />} texto={local} className="text-xs text-muted-foreground" />}
        <p className={`mt-1 flex items-center gap-1 border-t pt-2 text-xs font-semibold ${destino ? 'text-primary' : 'font-normal text-muted-foreground'}`}>
          {destino ? <>{destino.texto}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></> : TEXTO_SEM_DESTINO}
        </p>
      </div>
    </>
  );

  const classeDoLink = 'block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <div
      ref={ref}
      role="region"
      aria-label={`Resumo de ${m.title}`}
      data-card-no-mapa
      onPointerEnter={onEntrar}
      onPointerLeave={onSair}
      style={{ width: LARGURA, left: pos?.left ?? alvo.pino.left, top: pos?.top ?? alvo.pino.top, visibility: pos ? 'visible' : 'hidden' }}
      className="fixed z-[150] overflow-hidden rounded-xl border border-border bg-popover text-sm text-popover-foreground shadow-lg animate-in fade-in-0 duration-150 motion-reduce:animate-none"
    >
      {destino?.tipo === 'site' ? (
        <a href={destino.endereco} target="_blank" rel="noopener noreferrer" className={classeDoLink}>{miolo}</a>
      ) : destino?.tipo === 'cadastro' ? (
        <Link to={destino.endereco} className={classeDoLink}>{miolo}</Link>
      ) : miolo}
    </div>
  );
}

function Icone({ icone, texto, className = '' }: { icone: ReactNode; texto: string; className?: string }) {
  return (
    <span className={`flex min-w-0 items-center gap-1 ${className}`}>
      <span className="shrink-0" aria-hidden>{icone}</span>
      <span className="truncate">{texto}</span>
    </span>
  );
}
